'use client';

import {useState, type FormEvent} from 'react';
import {Alert, Button, Card, Description, FieldError, Form, InputGroup, Label, TextField} from '@heroui/react';
import {ArrowRight, Building2, Check, Eye, EyeOff, LockKeyhole, Radar, Sparkles, UserRound} from 'lucide-react';
import {ThemeToggle} from './theme-provider';

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
    <main className="relative grid min-h-dvh min-w-0 bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6"><ThemeToggle/></div>
      <aside className="relative hidden min-w-0 flex-col justify-between overflow-hidden border-r border-border bg-surface px-12 py-10 lg:flex xl:px-20" aria-label="QuoVadis">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Radar size={22}/></div>
          <div><p className="text-xl font-semibold tracking-tight">quovadis</p><p className="mt-0.5 text-[10px] font-semibold tracking-[0.25em] text-muted">BY PLLANA</p></div>
        </div>
        <div className="mx-auto w-full max-w-lg py-16">
          <p className="mb-6 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-accent"><span className="size-1.5 rounded-full bg-accent"/> DEIN IT OPPORTUNITY RADAR</p>
          <h2 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] xl:text-6xl">Die nächste<br/>gute Verbindung.</h2>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-muted">Relevante Signale entdecken. Unternehmen verstehen. Mit dem richtigen Anlass ins Gespräch kommen.</p>
          <Card className="mt-12 border border-border bg-surface-secondary p-6 shadow-none">
            <Card.Content className="space-y-6 p-0">
              {[{icon: Radar, title: 'Ein Signal macht den Anfang.', text: 'Aktuellen IT-Bedarf erkennen.'}, {icon: Building2, title: 'Ein klares Bild der Firma.', text: 'Öffentliche Daten und belegte Kontakte.'}, {icon: Sparkles, title: 'Dein nächster guter Lead.', text: 'Passung bewerten und Kontakt aufnehmen.'}].map(({icon: Icon, title, text}, index) => (
                <div key={title} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={19}/></div>
                  <div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-muted">{text}</p></div>
                  <span className="pt-1 text-xs font-medium text-muted">0{index + 1}</span>
                </div>
              ))}
            </Card.Content>
          </Card>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted"><Check size={14}/> Dein Arbeitsbereich für bessere Kundenbeziehungen.</p>
      </aside>

      <section className="flex min-h-dvh min-w-0 flex-col px-4 py-6 sm:px-12 sm:py-8 lg:px-16" aria-labelledby="auth-title">
        <div className="flex min-h-[44px] items-center gap-2 pr-14 text-lg font-semibold tracking-tight lg:hidden"><Radar size={24} className="shrink-0 text-accent"/> quovadis</div>
        <div className="mx-auto my-auto w-full min-w-0 max-w-sm py-10 sm:py-16">
          <span className="mb-6 inline-flex rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-muted">{setup ? 'Dein erster Schritt' : 'Dein Arbeitsbereich'}</span>
          <h1 id="auth-title" className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{setup ? 'Willkommen bei QuoVadis.' : 'Willkommen zurück.'}</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">{setup ? 'Erstelle deinen Administratorzugang. Danach richtest du deine tägliche Recherche ein.' : 'Melde dich an und entdecke deine nächsten Opportunities.'}</p>

          <Form className="mt-8 flex min-w-0 flex-col gap-5 sm:mt-9" onSubmit={submit}>
            <TextField className="min-w-0" name="username" isRequired minLength={setup ? 3 : undefined} value={username} onChange={setUsername} isDisabled={pending}>
              <Label>Benutzername</Label>
              <InputGroup className="mt-1 min-h-[48px] w-full min-w-0">
                <InputGroup.Prefix><UserRound size={18} className="text-muted"/></InputGroup.Prefix>
                <InputGroup.Input className="min-h-[44px] min-w-0 text-base sm:text-sm" autoComplete="username" autoCapitalize="none" autoCorrect="off" placeholder="Dein Benutzername"/>
              </InputGroup>
              <FieldError/>
            </TextField>
            <TextField className="min-w-0" name="password" type={showPassword ? 'text' : 'password'} isRequired minLength={setup ? 16 : 1} value={password} onChange={setPassword} isDisabled={pending}>
              <Label>Passwort</Label>
              <InputGroup className="mt-1 min-h-[48px] w-full min-w-0">
                <InputGroup.Prefix><LockKeyhole size={18} className="text-muted"/></InputGroup.Prefix>
                <InputGroup.Input className="min-h-[44px] min-w-0 text-base sm:text-sm" autoComplete={setup ? 'new-password' : 'current-password'} placeholder="Dein Passwort"/>
                <InputGroup.Suffix className="shrink-0 px-1"><Button isIconOnly variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] touch-manipulation" type="button" aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'} aria-pressed={showPassword} onPress={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</Button></InputGroup.Suffix>
              </InputGroup>
              {setup && <Description>Mindestens 16 Zeichen.</Description>}
              <FieldError/>
            </TextField>
            {error && <Alert status="danger" className="min-w-0"><Alert.Content className="min-w-0"><Alert.Description className="break-words">{error}</Alert.Description></Alert.Content></Alert>}
            <Button type="submit" variant="primary" size="lg" className="mt-2 min-h-[48px] w-full touch-manipulation" isPending={pending} isDisabled={pending}>{pending ? 'Einen Moment …' : setup ? 'Zugang erstellen' : 'Anmelden'}{!pending && <ArrowRight size={18}/>}</Button>
          </Form>
        </div>
        <p className="flex items-center justify-center gap-2 text-xs text-muted"><LockKeyhole size={13}/> Geschützter Zugang · PLLANA</p>
      </section>
    </main>
  );
}
