"use client";

export default function Comparison() {
  const bots = [
    {
      name: "Jockie Music",
      strengths: "Soporta muchisimas fuentes (Tidal, Deezer)",
      weaknesses: "Interfaz de comandos compleja y muy saturada",
      pricing: "Premium por niveles y cantidad de bots",
      color: "from-orange-500 to-red-500"
    },
    {
      name: "FredBoat",
      strengths: "Es un clasico, extremadamente estable",
      weaknesses: "Audio estandar (128kbps), sin funciones de vanguardia",
      pricing: "Gratuito / Donaciones",
      color: "from-blue-500 to-cyan-500"
    },
    {
      name: "Uzox",
      strengths: "Muy buen diseno de mensajes",
      weaknesses: "Se cae seguido cuando YouTube actualiza sus politicas",
      pricing: "Premium para filtros y playlists",
      color: "from-purple-500 to-pink-500"
    },
    {
      name: "Hydra",
      strengths: "Panel web (Dashboard) muy estetico",
      weaknesses: "Obliga a usar su web; los comandos en Discord son limitados",
      pricing: "Suscripcion mensual cara",
      color: "from-green-500 to-emerald-500"
    },
    {
      name: "BYPASS",
      strengths: "Audio 320kbps desde el Tier 1, trato directo e identidad indie",
      weaknesses: "Menos infraestructura inicial (hosteado en casa)",
      pricing: "Patreon (Fase de Fundadores: el mas barato)",
      color: "from-[#5865f2] to-[#eb459e]",
      highlight: true
    }
  ];

  return (
    <section id="comparison" className="py-24 bg-[#0f0f23]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Por que <span className="gradient-text">BYPASS</span>?
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Comparacion con otros bots de musica populares
          </p>
        </div>

        <div className="hidden lg:block overflow-x-auto mb-24">
          <table className="w-full max-w-6xl mx-auto">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-gray-400 font-semibold">Bot</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Fortalezas</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Debilidades (Tu oportunidad)</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Modelo de Pago</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot, index) => (
                <tr 
                  key={index} 
                  className={`border-b border-white/5 transition-all ${
                    bot.highlight 
                      ? 'bg-gradient-to-r from-[#5865f2]/10 to-[#eb459e]/10 hover:from-[#5865f2]/20 hover:to-[#eb459e]/20' 
                      : 'hover:bg-white/5'
                  }`}
                >
                  <td className="p-4">
                    <div className={`font-bold text-lg ${bot.highlight ? 'gradient-text' : 'text-white'}`}>
                      {bot.name}
                      {bot.highlight && (
                        <span className="ml-2 text-xs px-2 py-1 bg-gradient-to-r from-[#5865f2] to-[#eb459e] text-white rounded-full">
                          NUESTRO BOT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-gray-300">{bot.strengths}</td>
                  <td className="p-4 text-gray-400">{bot.weaknesses}</td>
                  <td className="p-4">
                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                      bot.highlight 
                        ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] text-white' 
                        : 'bg-white/10 text-gray-300'
                    }`}>
                      {bot.pricing}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden grid gap-4 mb-24">
          {bots.map((bot, index) => (
            <div 
              key={index}
              className={`glass-card rounded-xl p-6 ${
                bot.highlight 
                  ? 'border-2 border-[#5865f2]' 
                  : ''
              }`}
            >
              <div className="mb-4">
                <h3 className={`text-xl font-bold mb-2 ${bot.highlight ? 'gradient-text' : 'text-white'}`}>
                  {bot.name}
                  {bot.highlight && (
                    <span className="ml-2 text-xs px-2 py-1 bg-gradient-to-r from-[#5865f2] to-[#eb459e] text-white rounded-full">
                      NUESTRO BOT
                    </span>
                  )}
                </h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Fortalezas</div>
                  <div className="text-gray-300">{bot.strengths}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Debilidades</div>
                  <div className="text-gray-400">{bot.weaknesses}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Modelo de Pago</div>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                    bot.highlight 
                      ? 'bg-gradient-to-r from-[#5865f2] to-[#eb459e] text-white' 
                      : 'bg-white/10 text-gray-300'
                  }`}>
                    {bot.pricing}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}