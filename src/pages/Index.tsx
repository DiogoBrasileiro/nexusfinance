import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function Index() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 font-sans text-zinc-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 text-center">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Sparkles size={24} />
        </div>
        
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Página Inicial (Index)
        </h1>
        
        <p className="text-zinc-500 mb-8">
          Esta é a sua página inicial (Index). A partir daqui você pode começar a construir as outras telas do seu app.
        </p>
        
        <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-100">
          <p className="text-sm font-medium text-zinc-600 mb-4">Teste de Interatividade</p>
          <button
            onClick={() => setCount((c) => c + 1)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-lg font-medium transition-colors w-full"
          >
            Cliques: {count}
          </button>
        </div>
      </div>
    </div>
  );
}
