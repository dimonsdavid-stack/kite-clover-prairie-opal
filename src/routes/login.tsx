import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '@/lib/auth/client';
import { UserButton } from '@/lib/auth/gates';
import { Shell, Panel } from '@/components/arclenos/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/login')({ component: Login });
function Login() {
  const [register,setRegister] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  return <Shell title="Your ARCLENØS account" lede="Save your work and access account services. Treasury and operator permissions are granted separately.">
    <div className="mx-auto max-w-md px-4 py-12"><Panel>
      <UserButton />
      <form className="space-y-5" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setMessage('');
        const form = new FormData(event.currentTarget);
        const email = String(form.get('email')); const password = String(form.get('password'));
        try {
          const result = register ? await authClient.signUp.email({email,password,name:String(form.get('name')),callbackURL:'/'}) : await authClient.signIn.email({email,password,callbackURL:'/'});
          if(result.error) setMessage(result.error.message ?? 'Sign-in failed');
          else window.location.assign('/');
        } catch { setMessage('Account service unavailable. Please try again later.'); }
        finally { setBusy(false); }
      }}>
        {register && <label className="block text-sm">Name<Input name="name" required maxLength={100} autoComplete="name" /></label>}
        <label className="block text-sm">Email<Input type="email" name="email" required maxLength={254} autoComplete="email" /></label>
        <label className="block text-sm">Password<Input type="password" name="password" required minLength={12} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} /></label>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button>
        <Button variant="ghost" type="button" onClick={() => setRegister(!register)}>{register ? 'Already have an account?' : 'Create an account'}</Button>
      </form>
    </Panel></div>
  </Shell>;
}
