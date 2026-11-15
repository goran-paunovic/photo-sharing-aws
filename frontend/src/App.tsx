import { Layout, Menu, Typography, Button, Spin } from 'antd';
import { AppstoreOutlined, CloudUploadOutlined, LogoutOutlined } from '@ant-design/icons';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { GalleryPage } from './pages/GalleryPage';
import { UploadPage } from './pages/UploadPage';
import { SharedPhotoPage } from './pages/SharedPhotoPage';
import { SignInPage } from './pages/SignInPage';
import { AuthProvider, useAuth } from './auth/AuthContext';
const { Header, Content, Sider } = Layout;
function ProtectedShell() {
  const loc = useLocation();
  const auth = useAuth();
  if (!auth.ready) return <div className="loading-page"><Spin size="large"/></div>;
  if (!auth.signedIn) return <SignInPage/>;
  const selected = loc.pathname.startsWith('/upload') ? '/upload' : '/';
  return <Layout className="shell"><Sider breakpoint="lg" collapsedWidth="0" theme="light"><div className="brand">FRAME / SHARE</div><Menu mode="inline" selectedKeys={[selected]} items={[{key:'/',icon:<AppstoreOutlined/>,label:<Link to="/">My photos</Link>},{key:'/upload',icon:<CloudUploadOutlined/>,label:<Link to="/upload">Upload</Link>}]}/></Sider><Layout><Header className="topbar"><Typography.Text strong>{auth.email ?? 'Photo library'}</Typography.Text><Button type="text" icon={<LogoutOutlined/>} onClick={() => void auth.logout()}>Sign out</Button></Header><Content className="content"><Routes><Route path="/" element={<GalleryPage/>}/><Route path="/upload" element={<UploadPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Content></Layout></Layout>;
}
function AppRoutes() { return <Routes><Route path="/s/:shareId" element={<SharedPhotoPage/>}/><Route path="*" element={<ProtectedShell/>}/></Routes>; }
export default function App(){return <BrowserRouter><AuthProvider><AppRoutes/></AuthProvider></BrowserRouter>}
