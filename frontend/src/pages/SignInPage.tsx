import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Segmented, Typography, message } from 'antd';
import { useAuth } from '../auth/AuthContext';

type Mode = 'signIn' | 'signUp' | 'confirm';
export function SignInPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(values: { email: string; password?: string; code?: string }) {
    setBusy(true); setError(undefined);
    try {
      setEmail(values.email);
      if (mode === 'signIn') await auth.login(values.email, values.password ?? '');
      if (mode === 'signUp') { await auth.register(values.email, values.password ?? ''); setMode('confirm'); message.success('Check your email for the confirmation code.'); }
      if (mode === 'confirm') { await auth.confirm(values.email, values.code ?? ''); setMode('signIn'); message.success('Email confirmed. You can now sign in.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed'); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><Card className="auth-card"><Typography.Title level={2}>FRAME / SHARE</Typography.Title><Typography.Paragraph type="secondary">A quieter place for your photos.</Typography.Paragraph>
    {mode !== 'confirm' && <Segmented block value={mode} onChange={v => setMode(v as Mode)} options={[{label:'Sign in',value:'signIn'},{label:'Create account',value:'signUp'}]}/>}
    {error && <Alert className="note" type="error" showIcon message={error}/>}
    <Form layout="vertical" onFinish={submit} initialValues={{email}}>
      <Form.Item label="Email" name="email" rules={[{required:true},{type:'email'}]}><Input autoComplete="email" placeholder="you@example.com"/></Form.Item>
      {mode !== 'confirm' && <Form.Item label="Password" name="password" rules={[{required:true,min:12,message:'Use at least 12 characters'}]}><Input.Password autoComplete={mode==='signIn'?'current-password':'new-password'}/></Form.Item>}
      {mode === 'confirm' && <Form.Item label="Email confirmation code" name="code" rules={[{required:true}]}><Input inputMode="numeric"/></Form.Item>}
      <Button block type="primary" htmlType="submit" loading={busy}>{mode==='signIn'?'Sign in':mode==='signUp'?'Create account':'Confirm email'}</Button>
    </Form>
    {mode === 'confirm' && <Button type="link" onClick={()=>setMode('signUp')}>Back</Button>}
  </Card></div>;
}
