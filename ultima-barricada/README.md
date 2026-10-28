# Última Barricada (Last Barricade)

RTS de sobrevivência zumbi em pixel art isométrica de voxels, jogado no navegador (computador ou celular). Você comanda um pequeno grupo de sobreviventes numa cidade procedural tomada pelos mortos: de dia, coleta recursos, constrói e explora; à noite, segura a base contra hordas cada vez maiores. A partida é **infinita, com pontuação**, e termina quando o QG cai ou não resta ninguém.

Abra `index.html` (direto do disco ou por um servidor estático). Não há dependências nem etapa de build.

**Idiomas:** português e inglês. O jogo começa no idioma do navegador (português se ele for `pt-*`, inglês nos demais casos) e pode ser trocado a qualquer momento pelos botões PT | EN do menu principal ou nas Configurações. A escolha fica salva.

> **English.** *Last Barricade* is a zombie-survival RTS in isometric voxel pixel art for desktop and mobile browsers. Lead a few survivors through a seeded procedural city: gather wood and scrap by day, loot hospitals, police stations and gas stations, build and upgrade walls, towers, turrets and generators on a grid, and hold the HQ against ever larger night hordes. The game is endless and scored. Open `index.html`; it starts in English unless your browser is set to Portuguese, and the PT | EN buttons on the main menu (or Settings) switch language at any time. A skippable tutorial runs on your first game, the build menu explains each structure before you build it, and there is a fullscreen button in the main and pause menus.

## Como se joga

- **Ciclo**: dia (~3,5 min; o primeiro dura 5) → crepúsculo (30 s, com aviso de onde a horda virá) → noite (~2 min de horda) → amanhecer, quando todos comem e a noite conta pontos. Há pausa tática e velocidades 1×, 2× e 3×.
- **Ordens contextuais**: com sobreviventes selecionados, o alvo define a ordem: chão = mover, zumbi = atacar, árvore/carro/destroços = coletar, local = saquear, torre = guarnecer, horta/oficina = trabalhar, enfermaria = tratar, obra = construir/reparar.
- **Comportamento automático**: quem está sem ordem na base constrói obras, repara estruturas, sobe nas torres (e nas janelas do QG) à noite, vai à enfermaria quando ferido e defende a base sozinho. Fora da base, segura a posição e atira no que se aproximar. Trabalhadores da horta e da oficina saem para defender ao anoitecer e voltam ao amanhecer, a menos que o prédio tenha turno noturno.
- **Esquadrões 1–4** como grupos de controle (botões na tela ou teclado).
- **Tutorial**: na primeira partida, um tutorial curto (e pulável) guia os primeiros passos — selecionar, coletar, abrir o menu de construção e erguer uma torre. O relógio fica parado enquanto ele dura. Ele pode ser repetido pelas Configurações.
- **Tela cheia**: botão no menu principal e no menu de pausa (onde o navegador permitir).

### Controles

| Ação | Computador | Celular |
| --- | --- | --- |
| Selecionar | clique; arrastar para caixa; Shift adiciona; duplo clique = todos na tela | toque; toque longo e arrastar para caixa; toque duplo = todos na tela |
| Ordem contextual | botão direito | toque no alvo com alguém selecionado |
| Câmera | WASD/setas, borda (opcional), botão do meio, mini-mapa | arrastar, mini-mapa |
| Zoom | roda do mouse | pinça |
| Construir | `B`; passar o mouse num card mostra os detalhes; clicar e posicionar (arrastar = linha de muros; Shift mantém o modo) | botão Construir; o 1º toque num card mostra os detalhes, ✓ Construir; tocar para posicionar, ✓ (modo Linha para muros) |
| Pausa / velocidade | `Espaço`, `+`/`−` | botões no topo |
| Esquadrões | `1`–`4`, `Ctrl`+número define | botões à esquerda |
| Outros | `A` atacar-mover, `S` segurar, `H` base, `Tab` ocioso, `R` reparar, `U` melhorar, `Del` demolir, `F6`/`F9` salvar/carregar rápido, `Esc` cancelar/menu | painel de seleção |

## Sistemas

- **Recursos**: comida, madeira, sucata, munição, combustível e remédios, com teto de estoque (QG + depósitos). Cada sobrevivente come 3 por dia; a falta causa fome (menos vida e velocidade), queda de moral, deserções e mortes. Sem munição, todos lutam com tacos. Mordidas matam em 5 minutos e transformam a vítima em zumbi, a menos que um médico ou a enfermaria use remédios.
- **Construções** (grade, dentro do território do QG, níveis 1–3, reparo, demolição com reembolso de 50%): barricada, muro, portão, torre de vigia, metralhadora, lança-chamas, holofote, armadilha de espinhos, mina terrestre, abrigo, depósito, refeitório, campo de treino, oficina, horta, serraria, gerador, enfermaria, laboratório e rádio. O menu de construção mostra, antes de construir, a descrição, o custo, a vida, a energia e o efeito de cada uma. Energia vem de geradores que queimam combustível; metralhadoras gastam munição do estoque; a oficina transforma sucata em munição e fabrica espingardas e rifles; o rádio atrai refugiados, mas também zumbis. Minas explodem sob os zumbis sem ferir suas estruturas (uso único); o lança-chamas queima um cone de zumbis gastando combustível; o refeitório reduz a comida consumida e dá moral; o campo de treino dá experiência a quem está livre na base; a serraria produz madeira; o laboratório transforma comida e sucata em remédios.
- **Dicas**: no começo, dicas curtas explicam os primeiros passos (podem ser desligadas nas configurações).
- **Defesa**: a horda segue um *flow field* até o QG em que cada estrutura custa proporcionalmente à sua vida. Assim, os zumbis contornam muros quando existe uma brecha razoável e, se a base estiver fechada, atacam o ponto mais fraco (portões e barricadas). Isso cria gargalos de verdade. Torres e o QG protegem quem está dentro (−60% de dano) e dão alcance; atrás de muros há cobertura contra ácido.
- **Zumbis**: errante, corredor, inchado (explode), brutamontes (derruba muros), cuspidor (ácido por cima de muros), gritador (atrai e acelera), blindado (resiste a tudo menos rifle), rastejante (baixo, difícil de acertar a distância), saltador (pula barricadas, muros e portões), pestilento (envenena quem chega perto e deixa uma nuvem tóxica ao morrer) e o Colosso nas Noites de Sangue (a cada 5 noites). Barulho de tiros atrai os que estão por perto; chuva abafa o som e neblina reduz a visão.
- **Exploração**: névoa de guerra e locais com perigo e recompensas próprias: casas, farmácias, supermercados, armazéns, loja de ferragens (projeto do holofote), posto de combustível (projeto do lança-chamas; pode explodir com tiros), delegacia (munição, armas e projetos da metralhadora e do rádio), hospital (remédios, projeto do laboratório e um possível médico), fábrica, fazenda, acampamentos (sobreviventes para resgatar, se houver camas), ruínas e ninhos (que geram zumbis até serem destruídos). O saque vai para a mochila e precisa voltar à base; se alguém morrer, a mochila fica no chão. Ainda há caixas espalhadas, postos de controle militares e lançamentos aéreos.
- **Dificuldade**: o orçamento da horda é `(8 + 6n + 0,6·n^1,6) × multiplicador`, e os tipos de zumbi são liberados noite a noite. A população errante do mapa também cresce. Há quatro dificuldades (Fácil a Pesadelo).
- **Objetivos**: uma cadeia de metas opcionais (erguer uma torre, alimentar a base, resgatar sobreviventes, achar o projeto da metralhadora, ligar um gerador, destruir ninhos, sobreviver à Noite de Sangue…) aparece no painel e dá recursos e pontos.
- **Pontuação**: noites × 1000 + abates × 10 + buscas × 50 + ninhos × 500 + sobreviventes vivos × 200 + objetivos × 300. Os recordes ficam no navegador.
- **Salvar/carregar**: 3 slots e um automático a cada amanhecer (`localStorage`), com exportação e importação em `.json`. Saves carregados continuam de forma determinística.

## Mapas procedurais

`js/sim/mapgen.js` gera um mapa de 128×128 a partir da seed (texto ou número):

1. Malha de ruas com espaçamento variado (avenidas de duas faixas perto da base) e trechos removidos entre blocos rurais.
2. Distritos por bloco: centro em ruínas, zona industrial, bairros residenciais, parques com lagos, floresta e fazendas, além de um rio opcional com pontes.
3. Locais de interesse posicionados com entrada voltada para a rua; os perigosos ficam a pelo menos 25 tiles da base.
4. Detalhes: árvores, arbustos, carros, destroços, contêineres, cercas, vazamentos tóxicos, incêndios, barreiras e caixas.
5. **Garantias**: a área inicial tem madeira, sucata e casas por perto, e nenhum zumbi a menos de 15 tiles. Um Dijkstra a partir da base abre caminho (corta árvores, faz pontes) até toda entrada e todo ponto de chegada de horda que estiver isolado.

## Arquitetura

Scripts clássicos (funcionam via `file://`) num namespace `UB`. A simulação é separada da apresentação:

```
index.html, style.css     casca, HUD e menus (DOM)
js/core/                  rng.js (mulberry32, hash, value noise), util.js (heap, base64), i18n.js (traduções)
js/i18n/                  pt.js e en.js: todos os textos do jogo, com as mesmas chaves
js/data/defs.js           todo o conteúdo e o balanceamento (só ids e números)
js/sim/                   world, mapgen, path (A* com orçamento por tick + flow field), spatial (hash espacial),
                          economy, buildings, combat, units, zombies, waves, explore, objectives, game (tick, comandos, save)
js/render/                voxel.js (modelos e baker isométrico), models.js, tiles.js, renderer.js
js/ui/                    input.js, hud.js, menus.js, tutorial.js, audio.js (WebAudio sintetizado)
js/main.js                App: seleção, modos, laço (sim 20 Hz fixa + render interpolado)
tests/                    run.js + *.test.js (Node), bot.js (jogador automático), visual.js (Playwright)
```

- `sim/*` não toca no DOM e só usa o RNG semeado do estado. A interface altera o jogo exclusivamente por `UB.Game.command()`, a mesma API usada pelo mouse, pelo toque, pelo bot e pelos testes. Assim, as regras são idênticas em todos os dispositivos.
- **Traduções**: a simulação não guarda texto, só chaves e parâmetros (`{k: 'msg.built', p: {b: 'wall'}}`); a interface formata na hora com `UB.I18N.t()`, então trocar de idioma no meio da partida atualiza tudo, inclusive o histórico. Marcadores como `{b|bld}` traduzem ids (prédios, locais, zumbis, recursos…). Para adicionar um idioma, copie `js/i18n/en.js`, traduza os valores, inclua o `<script>` em `index.html` e registre o código em `LANGS`, `TAG` e `NAMES` no início de `js/core/i18n.js`; os seletores do menu e das configurações são gerados a partir dessa lista. `tests/i18n.test.js` confere se os dicionários têm as mesmas chaves e se toda chave usada no código existe.
- **Escala**: hash espacial para vizinhança e alvos; a IA "pensa" em intervalos escalonados (mais vezes perto do jogador) enquanto o movimento roda todo tick; pedidos de A\* entram numa fila com orçamento de nós por tick; o flow field da horda só é recalculado quando as estruturas mudam (no máximo 1×/s).
- **Visual**: cada modelo de voxel é assado uma vez num sprite com sombreamento por face, contorno escuro e sombra projetada. O terreno fica em blocos de 16×16 tiles em cache. Os objetos são ordenados por profundidade, e prédios grandes são fatiados em colunas de meio tile. Por cima vêm névoa suave, iluminação noturna com fontes de luz, clima, partículas e decalques. O canvas trabalha em baixa resolução com ampliação inteira.

## Testes

```
node tests/run.js           # 48 testes (mapa, caminhos, economia, construção, combate, novas construções e zumbis, save, 5 dias com bot, traduções)
node tests/visual.js        # navegador: menus, tutorial, detalhes de construção, tela cheia, mouse, toque, save/reload, idiomas, FPS com 500+ zumbis
```

`tests/visual.js` usa o Playwright com Chromium e grava capturas em `tests/screens/` (ignorada pelo git).
