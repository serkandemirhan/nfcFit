import React from 'react';

export default function TagLanding() {
  const id = window.location.pathname.split('/')[2] ?? '';
  const valid = /^\/tag\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(window.location.pathname);
  const appUrl = `nfcfit://tag/${encodeURIComponent(id.toLowerCase())}`;
  return <main style={{ minHeight: '100vh', background: '#F4F7F5', color: '#17251C', fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', padding: 24 }}>
    <section style={{ width: '100%', maxWidth: 440, background: '#FFFFFF', border: '1px solid #DFE8E1', borderRadius: 24, padding: 28 }}>
      <p style={{ color: '#16803C', fontWeight: 800 }}>NFCFit</p><h1>{valid ? 'Kartınızı NFCFit ile açın' : 'Kart bağlantısı geçerli değil'}</h1>
      {valid && <><p style={{ lineHeight: 1.6 }}>Uygulama kuruluysa aşağıdaki düğmeyle devam edin. Giriş yaptıktan sonra kartın güncel egzersizini görüntüleyebilirsiniz.</p>
        <a href={appUrl} style={{ display: 'block', background: '#16803C', color: '#FFF', borderRadius: 12, padding: 14, textDecoration: 'none', fontWeight: 700, textAlign: 'center', margin: '20px 0' }}>NFCFit uygulamasında aç</a>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>Uygulama açılmıyorsa güncel NFCFit sürümünü salon yöneticinizden edinin. Uygulama yüklü değilse bu düğme yükleme yapmaz.</p></>}
      <a href="/console" style={{ color: '#16803C' }}>Web paneline git</a>
    </section>
  </main>;
}
