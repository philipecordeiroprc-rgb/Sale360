export default function NotFound() {
  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#020617',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '6rem', fontWeight: 900, color: '#818cf8', margin: 0 }}>404</h1>
          <p style={{ fontSize: '1.25rem', color: '#94a3b8', marginTop: '0.5rem' }}>
            Página não encontrada
          </p>
          <a
            href="/dashboard"
            style={{
              marginTop: '2rem',
              padding: '0.75rem 1.5rem',
              background: '#6366f1',
              color: '#fff',
              borderRadius: '0.75rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Voltar ao Painel
          </a>
        </div>
      </body>
    </html>
  );
}
