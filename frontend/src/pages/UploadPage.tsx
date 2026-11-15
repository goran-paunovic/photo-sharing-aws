import { useState } from 'react';
import { Alert, Button, Card, Typography, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { apiRequest, type UploadIntent } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
const { Dragger } = Upload;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 20 * 1024 * 1024;
export function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const props: UploadProps = {
    multiple: true, accept: ACCEPTED.join(','), fileList: files.map((file, i) => ({uid:`${file.name}-${i}`,name:file.name,status:'done' as const,originFileObj:file as never})),
    beforeUpload: file => {
      if (!ACCEPTED.includes(file.type)) { message.error(`${file.name}: unsupported image type`); return Upload.LIST_IGNORE; }
      if (file.size > MAX_BYTES) { message.error(`${file.name}: maximum size is 20 MiB`); return Upload.LIST_IGNORE; }
      setFiles(current => [...current, file]); return false;
    },
    onRemove: file => { setFiles(current => current.filter(item => item.name !== file.name)); return true; },
  };
  async function start() {
    if (!files.length || busy) return;
    setBusy(true);
    const failures: string[] = [];
    const failedFiles: File[] = [];
    for (const file of files) {
      try {
        const intent = await apiRequest<UploadIntent>('/photos/upload-url', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName:file.name,contentType:file.type,sizeBytes:file.size})});
        const upload = await fetch(intent.uploadUrl, {method:'PUT',headers:intent.headers,body:file});
        if (!upload.ok) throw new Error(`S3 upload failed (${upload.status})`);
        await apiRequest<void>('/photos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({photoId:intent.photoId})});
      } catch (error) { failedFiles.push(file); failures.push(`${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`); }
    }
    setFiles(failedFiles); setBusy(false);
    await queryClient.invalidateQueries({queryKey:['photos']});
    if (failures.length) message.error(failures.join(' | ')); else message.success('All photos uploaded. Processing will continue in the background.');
  }
  return <section><Typography.Title level={2}>Upload photos</Typography.Title><Typography.Paragraph type="secondary">Images upload directly to a private S3 bucket. Thumbnail generation runs asynchronously.</Typography.Paragraph><Card><Dragger {...props}><p className="ant-upload-drag-icon"><InboxOutlined/></p><p className="ant-upload-text">Click or drag images into this area</p><p className="ant-upload-hint">JPEG, PNG or WebP · up to 20 MiB per image</p></Dragger><div className="upload-actions"><Typography.Text type="secondary">{files.length} file(s) selected</Typography.Text><Button type="primary" disabled={!files.length} loading={busy} onClick={() => void start()}>Start upload</Button></div></Card><Alert className="note" type="info" showIcon message="Upload uses a short-lived presigned URL. Your AWS credentials never reach the browser."/></section>;
}
