'use client';

import {useState, type FormEvent} from 'react';
import {Alert, Button, Card, Description, FieldError, Form, InputGroup, Label, TextField} from '@heroui/react';
import {ArrowRight, Building2, Check, Eye, EyeOff, LockKeyhole, Radar, Sparkles, UserRound} from 'lucide-react';

export default function AuthPanel({setup, onSuccess}: {setup: boolean; onSuccess: () => void}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mode: setup ? 'setup' : 'login', username, password}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Die Anmeldung ist fehlgeschlagen.');
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/^Error: /, '') : 'Die Anmeldung ist fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-white text-slate-950 lg:grid-cols-[1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-200 bg-slate-50 px-12 py-10 lg:flex xl:px-20" aria-label="QuoVadis">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-600 text-white"><Radar size={22}/></div>
          <div><p className="text-xl font-semibold tracking-tight">quovadis</p><p className="mt-0.5 text-[10px] font-semibold tracking-[0.25em] text-slate-400">BY PLLANA</p></div>
        </div>
        <div className="mx-auto w-full max-w-lg py-16">
          <p className="mb-6 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-blue-600"><span className="size-1.5 rounded-full bg-blue-600"/> DEIN IT OPPORTUNITY RADAR</p>
          <h2 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] xl:text-6xl">Die nächste<br/>gute Verbindung.</h2>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-slate-500">Relevante Signale entdecken. Unternehmen verstehen. Mit dem richtigen Anlass ins Gespräch kommen.</p>
          <Card className="mt-12 border border-slate-200 bg-white p-6 shadow-sm">
            <Card.Content className="space-y-6 p-0">
              {[{icon: Radar, title: 'Ein Signal macht den Anfang.', text: 'Aktuellen IT-Bedarf erkennen.'}, {icon: Building2, title: 'Ein klares Bild der Firma.', text: 'Öffentliche Daten und belegte Kontakte.'}, {icon: Sparkles, title: 'Dein nächster guter Lead.', text: 'Passung bewerten und Kontakt aufnehmen.'}].map(({icon: Icon, title, text}, index) => (
                <div key={title} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={19}/></div>
                  <div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>
                  <span className="pt-1 text-xs font-medium text-slate-300">0{index + 1}</span>
                </div>
              ))}
            </Card.Content>
          </Card>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400"><Check size={14}/> Dein Arbeitsbereich für bessere Kundenbeziehungen.</p>
      </aside>

      <section className="flex min-h-dvh flex-col px-6 py-8 sm:px-12 lg:px-16" aria-labelledby="auth-title">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight lg:hidden"><Radar size={24} className="text-blue-600"/> quovadis</div>
        <div className="mx-auto my-auto w-full max-w-sm py-16">
          <span className="mb-6 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">{setup ? 'Dein erster Schritt' : 'Dein Arbeitsbereich'}</span>
          <h1 id="auth-title" className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{setup ? 'Willkommen bei QuoVadis.' : 'Willkommen zurück.'}</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">{setup ? 'Erstelle deinen Administratorzugang. Danach richtest du deine tägliche Recherche ein.' : 'Melde dich an und entdecke deine nächsten Opportunities.'}</p>

          <Form className="mt-9 flex flex-col gap-5" onSubmit={submit}>
            <TextField name="username" isRequired minLength={setup ? 3 : undefined} value={username} onChange={setUsername} isDisabled={pending}>
              <Label>Benutzername</Label>
              <InputGroup className="mt-1 h-12">
                <InputGroup.Prefix><UserRound size={18} className="text-slate-400"/></InputGroup.Prefix>
                <InputGroup.Input autoComplete="username" placeholder="Dein Benutzername"/>
              </InputGroup>
              <FieldError/>
            </TextField>
            <TextField name="password" type={showPassword ? 'text' : 'password'} isRequired minLength={setup ? 16 : 1} value={password} onChange={setPassword} isDisabled={pending}>
              <Label>Passwort</Label>
              <InputGroup className="mt-1 h-12">
                <InputGroup.Prefix><LockKeyhole size={18} className="text-slate-400"/></InputGroup.Prefix>
                <InputGroup.Input autoComplete={setup ? 'new-password' : 'current-password'} placeholder="Dein Passwort"/>
                <InputGroup.Suffix><Button isIconOnly variant="ghost" size="sm" type="button" aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'} aria-pressed={showPassword} onPress={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</Button></InputGroup.Suffix>
              </InputGroup>
              {setup && <Description>Mindestens 16 Zeichen.</Description>}
              <FieldError/>
            </TextField>
            {error && <Alert status="danger"><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
            <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" isPending={pending} isDisabled={pending}>{pending ? 'Einen Moment …' : setup ? 'Zugang erstellen' : 'Anmelden'}{!pending && <ArrowRight size={18}/>}</Button>
          </Form>
        </div>
        <p className="flex items-center justify-center gap-2 text-xs text-slate-400"><LockKeyhole size={13}/> Geschützter Zugang · PLLANA</p>
      </section>
    </main>
  );
}
