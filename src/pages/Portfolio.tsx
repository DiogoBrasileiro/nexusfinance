export function Portfolio() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Carteira Cripto</h1>
        <p className="text-zinc-500 mt-1">Exposição atual em BTC, ETH e SOL.</p>
      </header>
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-zinc-200 text-center text-zinc-500">
        <p>Módulo de gestão de portfólio em desenvolvimento. Aqui você poderá inserir suas posições manuais ou conectar via API.</p>
      </div>
    </div>
  );
}
