# Planolândia — Fora do Plano

Metroidvania de plataforma em 2.5D, em pixel art cartunesca com animação procedural, feito com **Phaser 4.2.1** (em português).

Um Quadrado de Planolândia é arrancado do seu mundo chato e jogado num mundo **3D de verdade** por uma entidade desconhecida. Como tem espessura zero, ele só enxerga a **fatia 2D** que passa pelo plano em que está. Ao deslizar para frente e para trás na profundidade, o terreno parece mudar: uma esfera vira um círculo que cresce e some, uma laje inclinada vira um elevador, uma barra girada vira uma plataforma que corre de lado. Nada se move. O que muda é o ponto de vista dele.

Abra `index.html` (direto do arquivo ou servido) e jogue. Funciona no computador e no celular (deitado).

## Estado: Marco 1 de 8

O Marco 1 traz o motor de fatias completo e a primeira região, a **Borda do Plano**:

- 10 salas interligadas: Chegada, Degraus Oblíquos, Mirante do Ponto Fixo, Campo das Formas, uma sala secreta acessível pela profundidade, Fenda Vertical, Salão das Barras Giradas, Antecâmara, Cela do Carcereiro e Vão da Investida.
- O Quadrado anda, pula com altura variável (com tempo de coyote e buffer de pulo), desliza na profundidade e ataca com o **golpe de Aresta** em 4 direções, com pogo no golpe para baixo. Também usa o **Foco**, que gasta Geometria para curar um Lado.
- 4 inimigos:
  - **Esferóide**: quica e oscila na profundidade.
  - **Cubo Sentinela**: o corte muda de largura quando ele gira; avista o Quadrado e investe.
  - **Agulha**: um cone que atravessa o plano depois de um anel de aviso.
  - **Rabisco**: um achatado que só existe num z.
- O chefão **Cubo Carcereiro** gira em 3D, e a forma do corte anuncia o ataque:
  - quadrado: esmaga, com ondas de choque;
  - hexágono: gira cortando, e só se escapa pela profundidade;
  - triângulo que cresce: investe pela profundidade.

  O núcleo (ponto fraco) só aparece quando o seu plano o atravessa. Na fase 2, faixas do chão caem, e no fim ele se planifica numa rede de 6 quadrados. A recompensa é a **Investida** (dash), que abre o vão no fim da região.
- Pontos Fixos (salvam, curam, viram ponto de retorno), Lados (vida), Geometria (energia de cura), Vértices (dinheiro), o **Contorno** (deixado onde você morreu, guarda os Vértices) e 3 Fragmentos de Lado escondidos.
- Mapa das salas visitadas, Régua de Profundidade no HUD, premonição pontilhada do que vai surgir e contorno tremulante no que vai sumir.
- Título, introdução, 3 espaços de salvamento, pausa, configurações (volumes, esquema de teclas, tremor, clarões, toque, modo economia, FPS) e tela de controles.
- Som e música 100% sintetizados (WebAudio): ambiente generativo da Borda e tema do chefão.

As saídas para o **Bosque dos Cones** (Marco 2) e para as **Minas Toroidais** (Marco 3) aparecem como fendas instáveis. O design completo e os próximos marcos estão em [`DESIGN.md`](DESIGN.md).

## Controles

| Ação | WASD (padrão) | Setas | Gamepad | Toque |
| --- | --- | --- | --- | --- |
| Andar | A / D | ← / → | analógico esq. / direcional | joystick à esquerda |
| Mirar / interagir | W / S | ↑ / ↓ | ↑ / ↓ | arrastar GOLPE ↑↓ · botão ▲ |
| Profundidade (trás / frente) | Q / E | A / S | LB / RB · analógico dir. | joystick ↑↓ (ou botões, nas configurações) |
| Pular | Espaço | Z | A | PULO |
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
node --test planolandia/tests/*.test.js          # cortes, colisão, física, salas, salvamento
python3 -m http.server 8765                      # na raiz do repositório, noutro terminal
node planolandia/tests/smoke.js                  # Playwright: menu, título, andar, profundidade, combate, chefão, toque
```

Atalhos de depuração pela URL: `index.html?room=borda_arena&x=260&y=314&z=100&god=1&debug=1&abilities=dash`. Com `debug=1` aparecem os colisores e a posição. `window.PL.debug` expõe o estado e funções de teleporte.

## Créditos

Design, código, arte procedural e som: gerados para esta coleção. Inspirado em *Flatland* (Edwin A. Abbott, 1884) e no combate de *Hollow Knight*.
