# Planolândia — Fora do Plano

Metroidvania de plataforma em 2.5D, em pixel art cartunesca com animação procedural, feito com **Phaser 4.2.1** (em português).

Um Quadrado de Planolândia é arrancado do seu mundo chato e jogado num mundo **3D de verdade** por uma entidade desconhecida. Como tem espessura zero, ele só enxerga a **fatia 2D** que passa pelo plano em que está. Ao deslizar para frente e para trás na profundidade, o terreno parece mudar: uma esfera vira um círculo que cresce e some, uma laje inclinada vira um elevador, uma barra girada vira uma plataforma que corre de lado. Nada se move. O que muda é o ponto de vista dele.

Abra `index.html` (direto do arquivo ou servido) e jogue. Funciona no computador e no celular (deitado).

## Estado: Marco 2 de 8

### Marco 1: núcleo e Borda do Plano

- 10 salas interligadas, incluindo uma sala secreta acessível pela profundidade.
- O Quadrado anda, pula com altura variável, desliza na profundidade e ataca com o **golpe de Aresta** em 4 direções, com pogo no golpe para baixo. Também usa o **Foco**, que gasta Geometria para curar um Lado.
- 4 inimigos:
  - **Esferóide**: oscila na profundidade.
  - **Cubo Sentinela**: o corte muda de largura ao girar.
  - **Agulha**: atravessa o plano depois de um aviso.
  - **Rabisco**: um achatado preso a um único z.
- O chefão **Cubo Carcereiro**: a forma do corte (quadrado, hexágono, triângulo) anuncia o ataque, e o núcleo só aparece na profundidade certa. Entrega a **Investida** (dash).
- Pontos Fixos, Lados, Geometria, Vértices, o **Contorno** deixado onde você morreu, Fragmentos de Lado, mapa, Régua de Profundidade, título, introdução, 3 espaços de salvamento e configurações.

### Marco 2: Bosque dos Cones

- **11 salas novas**, com entrada por um elevador de profundidade no teto do Mirante do Ponto Fixo:
  - Raízes, Trilha dos Troncos, Toca Escondida (pela profundidade), Copas (exige Investida);
  - Clareira do Segmento, Tenda do Pentágono, Brejo dos Cogumelos, Cipós Oblíquos;
  - Antessala, Ninho da Mãe-Esfera e Copa Alta (exige Garra).
- **Troncos** são cilindros em pé que afinam e somem conforme você desliza. **Cogumelos** com chapéu em cone lançam você para o alto. **Cipós** e raízes verdes são elevadores de profundidade.
- **Garra de Vértice:** agarre-se às paredes no ar e pule de uma para a outra.
- 4 inimigos novos:
  - **Brotocone**: cone que cospe esporos.
  - **Esporo**: projétil 3D do qual se desvia pela profundidade.
  - **Rolo**: tronco que rola e investe.
  - **Folha**: lâmina que voa e mergulha.
- O chefão **Mãe-Esfera**:
  - um círculo que nasce de um ponto, cresce e some;
  - o olho no equador só aparece quando você está na profundidade em que ela é maior;
  - na metade da vida, divide-se em duas Filhas;
  - no fim, murcha num disco e entrega a Garra, com uma fala que a liga à esfera de *Flatland*.
- **NPCs com diálogos:** Segmento (uma Linha anciã) e Pentágono (cartógrafo e mercador).
- **Loja:** mapa da região, Teoremas e um Fragmento de Lado.
- **Veios de Vértices:** rochas que se quebram.
- **6 Teoremas** (amuletos) em 3 Postulados, trocados descansando num Ponto Fixo:

  | Teorema | Efeito |
  | --- | --- |
  | Ângulo Reto | golpe mais rápido |
  | Ímã de Vértices | atrai Vértices de longe |
  | Pitágoras | alcance maior |
  | Paralelas | profundidade mais rápida |
  | Lema do Foco | cura mais rápida |
  | Bissetriz | o golpe atinge fatias vizinhas |

- Música generativa do Bosque, tema da Mãe-Esfera em 6/8, vagalumes e silhuetas de árvores-cone no fundo.

A saída para as **Minas Toroidais** (Marco 3) e a passagem para a **Cidade dos Sólidos** (Marco 4) aparecem como fendas instáveis. O design completo está em [`DESIGN.md`](DESIGN.md).

## Controles

| Ação | WASD (padrão) | Setas | Gamepad | Toque |
| --- | --- | --- | --- | --- |
| Andar | A / D | ← / → | analógico esq. / direcional | joystick à esquerda |
| Mirar / interagir | W / S | ↑ / ↓ | ↑ / ↓ | arrastar GOLPE ↑↓ · botão ▲ |
| Profundidade (trás / frente) | Q / E | A / S | LB / RB · analógico dir. | joystick ↑↓ (ou botões, nas configurações) |
| Pular (e pular da parede, com a Garra) | Espaço | Z | A | PULO |
| Golpe de Aresta | J · clique esq. | X | X | GOLPE |
| Investida | K · Shift | C | B | INVEST. |
| Foco (curar) | L · botão dir. | V | Y | FOCO (segurar) |
| Mapa · Pausa | M/Tab · Esc | M · Esc | Select · Start | MAPA · ❚❚ |

## Estrutura

```
index.html, style.css      página e escala nítida (resolução interna de 270 px de altura)
DESIGN.md                  lore, mundo, habilidades, chefões, marcos
vendor/phaser.min.js       Phaser 4.2.1 (MIT, licença em vendor/PHASER-LICENSE.md)
src/core/                  sem Phaser: geom3d (sólidos e cortes), collide2d (SAT), physics, world (salas)
src/data/                  materiais/paletas e salas (rooms/borda.js)
src/render/                fatias (RenderTexture redesenhada só quando z muda), partículas 3D, fundo
src/game/                  entrada, jogador, inimigos, chefão, entidades, salvamento, controlador da partida
src/ui/                    fonte pixel gerada em código, HUD, menus, mapa, toque
src/audio/synth.js         efeitos e música generativa
src/scenes/                Boot, Título, Introdução, Jogo
tests/                     testes em Node e teste de fumaça no navegador
```

Os scripts são clássicos (sem módulos nem build), num namespace global `PL`, para abrir também por `file://`. O núcleo exporta via `module.exports` para os testes.

## Testes

```
node --test planolandia/tests/*.test.js          # cortes, colisão, física, salas, salvamento, Garra, Teoremas, loja
python3 -m http.server 8765                      # na raiz do repositório, noutro terminal
node planolandia/tests/smoke.js                  # Playwright: menu, título, andar, profundidade, combate, os dois chefões, Bosque, loja, toque
```

Atalhos de depuração pela URL: `index.html?room=borda_arena&x=260&y=314&z=100&god=1&debug=1&abilities=dash`. Com `debug=1` aparecem os colisores e a posição. `window.PL.debug` expõe o estado e funções de teleporte.

## Créditos

Design, código, arte procedural e som: gerados para esta coleção. Inspirado em *Flatland* (Edwin A. Abbott, 1884) e no combate de *Hollow Knight*.
