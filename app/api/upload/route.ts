import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorageDriver } from '@/lib/storage';
import { sanitizePath } from '@/lib/utils';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // ========================================================
    // MODE A: JSON Handler (Presigned Direct S3 Upload & Complete)
    // Bypasses Vercel Serverless 4.5MB payload limit completely!
    // ========================================================
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { action, workspaceId, targetFolderId = null } = body;

      if (!workspaceId) {
        return NextResponse.json(
          { success: false, error: 'معرّف مساحة العمل مطلوب' },
          { status: 400 }
        );
      }

      // Boundary Check
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        return NextResponse.json(
          { success: false, error: 'مساحة العمل غير موجودة. تم منع الرفع خارج النطاق.' },
          { status: 404 }
        );
      }

      let baseTargetFolder: { id: string; path: string; workspaceId: string } | null = null;
      if (targetFolderId && targetFolderId !== 'root') {
        baseTargetFolder = await prisma.folder.findUnique({
          where: { id: targetFolderId },
        });

        if (!baseTargetFolder || baseTargetFolder.workspaceId !== workspaceId) {
          return NextResponse.json(
            {
              success: false,
              error: 'محاولة رفع خارج نطاق مساحة العمل المحددة! تم إيقاف العملية لأسباب أمنية.',
            },
            { status: 403 }
          );
        }
      }

      // ----------------------------------------------------
      // ACTION 1: Presign Upload Plan
      // ----------------------------------------------------
      if (action === 'presign') {
        const files: Array<{
          name: string;
          relativePath?: string;
          size: number;
          mimeType?: string;
        }> = body.files || [];

        if (files.length === 0) {
          return NextResponse.json(
            { success: false, error: 'لم يتم تحديد أي ملفات' },
            { status: 400 }
          );
        }

        // Quota check
        const totalNewBytes = files.reduce((acc, f) => acc + BigInt(f.size || 0), BigInt(0));
        if (workspace.usedStorageBytes + totalNewBytes > workspace.storageQuotaBytes) {
          return NextResponse.json(
            {
              success: false,
              error: 'تم تجاوز الحد الأقصى للمساحة التخزينية المخصصة لهذا العميل.',
            },
            { status: 413 }
          );
        }

        const storage = getStorageDriver();

        // If active driver is S3 and supports presigned PUT upload
        if (storage.name === 's3' && storage.getPresignedUploadUrl) {
          const folderCache = new Map<string, string>();

          const resolveNestedFolder = async (
            baseParentId: string | null,
            folderNames: string[]
          ): Promise<string | null> => {
            let currentParentId = baseParentId;
            let currentPath = baseTargetFolder ? baseTargetFolder.path : '';

            for (const rawName of folderNames) {
              const cleanName = rawName.trim().replace(/[\\/:*?"<>|]/g, '-');
              if (!cleanName) continue;

              const cacheKey = `${currentParentId || 'root'}:${cleanName}`;
              if (folderCache.has(cacheKey)) {
                currentParentId = folderCache.get(cacheKey)!;
                currentPath = `${currentPath}/${cleanName}`;
                continue;
              }

              let existingFolder = await prisma.folder.findFirst({
                where: {
                  workspaceId,
                  parentId: currentParentId,
                  name: cleanName,
                },
              });

              if (!existingFolder) {
                const newPath = `${currentPath}/${cleanName}`;
                existingFolder = await prisma.folder.create({
                  data: {
                    workspaceId,
                    parentId: currentParentId,
                    name: cleanName,
                    path: newPath,
                  },
                });
              }

              folderCache.set(cacheKey, existingFolder.id);
              currentParentId = existingFolder.id;
              currentPath = existingFolder.path;
            }

            return currentParentId;
          };

          const plannedFiles = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const relPath = f.relativePath ? sanitizePath(f.relativePath) : f.name;
            const pathSegments = relPath.split('/').filter(Boolean);
            const fileName = pathSegments.pop() || f.name;
            const cleanFileName = fileName.replace(/[\\/:*?"<>|]/g, '-');

            const destinationFolderId = await resolveNestedFolder(
              baseTargetFolder ? baseTargetFolder.id : null,
              pathSegments
            );

            const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            const safeRelativePath = pathSegments.join('/');
            const storageKey = `workspaces/${workspaceId}/${safeRelativePath ? safeRelativePath + '/' : ''}${uniqueSuffix}-${cleanFileName}`.replace(
              /\/+/g,
              '/'
            );

            const mimeType = f.mimeType || 'application/octet-stream';
            const ext = path.extname(cleanFileName).replace('.', '').toLowerCase();

            const uploadUrl = await storage.getPresignedUploadUrl(storageKey, mimeType, 3600);

            plannedFiles.push({
              fileIndex: i,
              originalName: f.name,
              cleanFileName,
              storageKey,
              uploadUrl,
              folderId: destinationFolderId,
              size: f.size,
              mimeType,
              ext,
            });
          }

          return NextResponse.json({
            success: true,
            mode: 'presigned',
            files: plannedFiles,
          });
        }

        // Fallback for local driver
        return NextResponse.json({
          success: true,
          mode: 'form_data',
        });
      }

      // ----------------------------------------------------
      // ACTION 2: Complete Upload (Save DB records after direct S3 upload)
      // ----------------------------------------------------
      if (action === 'complete') {
        const uploadedFiles: Array<{
          name: string;
          originalName: string;
          storageKey: string;
          size: number;
          mimeType: string;
          extension: string;
          folderId: string | null;
        }> = body.uploadedFiles || [];

        if (uploadedFiles.length === 0) {
          return NextResponse.json(
            { success: false, error: 'لا توجد ملفات مكتملة لتسجيلها' },
            { status: 400 }
          );
        }

        let totalBytes = BigInt(0);
        const createdRecords = [];

        for (const item of uploadedFiles) {
          const sizeBig = BigInt(item.size || 0);
          totalBytes += sizeBig;

          const fileRecord = await prisma.fileItem.create({
            data: {
              workspaceId,
              folderId: item.folderId || null,
              name: item.name,
              originalName: item.originalName,
              storageKey: item.storageKey,
              size: sizeBig,
              mimeType: item.mimeType,
              extension: item.extension,
              storageDriver: 's3',
            },
          });

          createdRecords.push(fileRecord);
        }

        // Update workspace usedStorageBytes
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            usedStorageBytes: workspace.usedStorageBytes + totalBytes,
          },
        });

        await prisma.auditActivity.create({
          data: {
            workspaceId,
            action: 'FILES_UPLOADED',
            details: `تم رفع ${createdRecords.length} ملفات سحابياً بتقنية الرفع المباشر بنجاح`,
          },
        });

        return NextResponse.json({
          success: true,
          count: createdRecords.length,
          message: `تم حفظ ${createdRecords.length} ملف بنجاح في قاعدة البيانات`,
        });
      }

      return NextResponse.json(
        { success: false, error: 'إجراء غير مدعوم' },
        { status: 400 }
      );
    }

    // ========================================================
    // MODE B: Standard FormData Upload (Local Development Fallback)
    // ========================================================
    const formData = await req.formData();
    const workspaceId = formData.get('workspaceId') as string;
    const targetFolderId = (formData.get('targetFolderId') as string) || null;

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'معرّف مساحة العمل مطلوب' },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'مساحة العمل غير موجودة. تم منع الرفع خارج النطاق.' },
        { status: 404 }
      );
    }

    let baseTargetFolder: { id: string; path: string; workspaceId: string } | null = null;
    if (targetFolderId && targetFolderId !== 'root') {
      baseTargetFolder = await prisma.folder.findUnique({
        where: { id: targetFolderId },
      });

      if (!baseTargetFolder || baseTargetFolder.workspaceId !== workspaceId) {
        return NextResponse.json(
          {
            success: false,
            error: 'محاولة رفع خارج نطاق مساحة العمل المحددة! تم إيقاف العملية لأسباب أمنية.',
          },
          { status: 403 }
        );
      }
    }

    const files = formData.getAll('files') as File[];
    const paths = formData.getAll('paths') as string[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'لم يتم إرسال أي ملفات للرفع' },
        { status: 400 }
      );
    }

    const totalNewBytes = files.reduce((acc, f) => acc + BigInt(f.size), BigInt(0));
    if (workspace.usedStorageBytes + totalNewBytes > workspace.storageQuotaBytes) {
      return NextResponse.json(
        {
          success: false,
          error: 'تم تجاوز الحد الأقصى للمساحة التخزينية المخصصة لهذا العميل.',
        },
        { status: 413 }
      );
    }

    const storage = getStorageDriver();
    const uploadedFiles: any[] = [];
    let uploadedBytes = BigInt(0);

    const folderCache = new Map<string, string>();

    const resolveNestedFolder = async (
      baseParentId: string | null,
      folderNames: string[]
    ): Promise<string | null> => {
      let currentParentId = baseParentId;
      let currentPath = baseTargetFolder ? baseTargetFolder.path : '';

      for (const rawName of folderNames) {
        const cleanName = rawName.trim().replace(/[\\/:*?"<>|]/g, '-');
        if (!cleanName) continue;

        const cacheKey = `${currentParentId || 'root'}:${cleanName}`;
        if (folderCache.has(cacheKey)) {
          currentParentId = folderCache.get(cacheKey)!;
          currentPath = `${currentPath}/${cleanName}`;
          continue;
        }

        let existingFolder = await prisma.folder.findFirst({
          where: {
            workspaceId,
            parentId: currentParentId,
            name: cleanName,
          },
        });

        if (!existingFolder) {
          const newPath = `${currentPath}/${cleanName}`;
          existingFolder = await prisma.folder.create({
            data: {
              workspaceId,
              parentId: currentParentId,
              name: cleanName,
              path: newPath,
            },
          });
        }

        folderCache.set(cacheKey, existingFolder.id);
        currentParentId = existingFolder.id;
        currentPath = existingFolder.path;
      }

      return currentParentId;
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = paths[i] ? sanitizePath(paths[i]) : file.name;

      const pathSegments = relPath.split('/').filter(Boolean);
      const fileName = pathSegments.pop() || file.name;
      const cleanFileName = fileName.replace(/[\\/:*?"<>|]/g, '-');

      const destinationFolderId = await resolveNestedFolder(
        baseTargetFolder ? baseTargetFolder.id : null,
        pathSegments
      );

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const safeRelativePath = pathSegments.join('/');
      const storageKey = `workspaces/${workspaceId}/${safeRelativePath ? safeRelativePath + '/' : ''}${uniqueSuffix}-${cleanFileName}`.replace(
        /\/+/g,
        '/'
      );

      const mimeType = file.type || 'application/octet-stream';
      const ext = path.extname(cleanFileName).replace('.', '').toLowerCase();

      const uploadResult = await storage.upload(storageKey, buffer, mimeType);

      const fileRecord = await prisma.fileItem.create({
        data: {
          workspaceId,
          folderId: destinationFolderId,
          name: cleanFileName,
          originalName: file.name,
          storageKey: uploadResult.key,
          size: BigInt(file.size),
          mimeType,
          extension: ext,
          storageDriver: uploadResult.driver,
        },
      });

      uploadedBytes += fileRecord.size;
      uploadedFiles.push({
        id: fileRecord.id,
        name: fileRecord.name,
        size: fileRecord.size.toString(),
        mimeType: fileRecord.mimeType,
      });
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        usedStorageBytes: workspace.usedStorageBytes + uploadedBytes,
      },
    });

    await prisma.auditActivity.create({
      data: {
        workspaceId,
        action: 'FILES_UPLOADED',
        details: `تم رفع ${uploadedFiles.length} ملفات بهيكلية متداخلة بنجاح`,
      },
    });

    return NextResponse.json({
      success: true,
      count: uploadedFiles.length,
      files: uploadedFiles,
      message: `تم رفع ${uploadedFiles.length} ملف بنجاح مع الحفاظ على الهيكلية الشجرية`,
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { success: false, error: `فشل في رفع الملفات: ${error.message || 'خطأ غير متوقع'}` },
      { status: 500 }
    );
  }
}
