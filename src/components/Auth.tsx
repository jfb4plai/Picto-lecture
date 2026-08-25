import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen } from 'lucide-react';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { signIn, signUp, passwordRecovery, sendPasswordReset, updatePassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMsg('');
    setLoading(true);
    const { error } = await sendPasswordReset(resetEmail);
    setResetMsg(error ? error.message : 'Email envoyé ! Vérifiez votre boîte mail.');
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('6 caractères minimum.'); return; }
    setLoading(true);
    const { error } = await updatePassword(newPassword);
    if (error) setError(error.message);
    setLoading(false);
  };

  if (passwordRecovery) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="plai-card w-full max-w-md shadow-xl" style={{ padding: '2rem' }}>
          <h1 className="font-serif text-2xl text-center text-[var(--text)] mb-6">
            Nouveau mot de passe
          </h1>
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label htmlFor="newPassword" className="plai-label">Nouveau mot de passe</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="plai-input"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {error && <div className="plai-error">{error}</div>}
            <button type="submit" disabled={loading} className="plai-btn w-full py-3 text-base">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (resetMode) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="plai-card w-full max-w-md shadow-xl" style={{ padding: '2rem' }}>
          <h1 className="font-serif text-2xl text-center text-[var(--text)] mb-2">
            Mot de passe oublié
          </h1>
          <p className="text-center text-[var(--text2)] mb-6 text-sm">
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
          <form onSubmit={handleSendReset} className="space-y-5">
            <div>
              <label htmlFor="resetEmail" className="plai-label">Email</label>
              <input
                id="resetEmail"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="plai-input"
                placeholder="votre@email.com"
                required
              />
            </div>
            {resetMsg && <div className="plai-error">{resetMsg}</div>}
            <button type="submit" disabled={loading} className="plai-btn w-full py-3 text-base">
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button
              onClick={() => setResetMode(false)}
              className="text-[var(--teal)] hover:opacity-80 text-sm font-medium transition"
            >
              ← Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="plai-card w-full max-w-md shadow-xl" style={{ padding: '2rem' }}>
        <div className="flex items-center justify-center mb-8">
          <div className="bg-[var(--teal)] p-3 rounded-full">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="font-serif text-3xl text-center text-[var(--text)] mb-2">
          Picto Lecture
        </h1>
        <p className="text-center text-[var(--text2)] mb-8">
          Aide à la lecture par pictogrammes
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="plai-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="plai-input"
              placeholder="votre@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="plai-label">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="plai-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="plai-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="plai-btn w-full py-3 text-base"
          >
            {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="block w-full text-[var(--teal)] hover:opacity-80 text-sm font-medium transition"
          >
            {isLogin ? "Créer un compte" : "Déjà inscrit ? Se connecter"}
          </button>
          {isLogin && (
            <button
              onClick={() => { setResetEmail(email); setResetMode(true); }}
              className="block w-full text-[var(--text2)] hover:opacity-80 text-sm transition"
            >
              Mot de passe oublié ?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
