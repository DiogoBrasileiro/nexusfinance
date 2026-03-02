export function Setups() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Setups do Dia</h1>
        <p className="text-zinc-500 mt-1">Lista de setups educacionais baseados no snapshot atual.</p>
      </header>
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-zinc-200 text-center text-zinc-500">
        <p>Os setups serão gerados automaticamente pelo agente SETUP_SCORER durante as análises.</p>
      </div>
    </div>
  );
}
