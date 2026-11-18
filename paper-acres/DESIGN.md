# Paper Acres - design

This is the approved design (originally written in Portuguese), followed by the changes the player asked for during development. Those changes take precedence over the original text.

## Changes requested during development

1. **Two colours only:** light beige (#efe4c8) and black. Tones come from character density, ordered dithering and inverted cells, never grey or alpha.
2. **Ruled lines:** thin and light. They are 1 device pixel and dotted.
3. **Minimalist outlines:** trees, townsfolk and creatures are outlines, empty inside. Trees later became more realistic (lumpy canopies, trunks with roots, species, bare branches in winter) but stayed hollow.
4. **Stickman:** first a classic 3x3 ASCII figure, then *"draw the stickman too and let the renderer turn him into ASCII"*. Finally *"more dynamic, closer to a real drawing"*: a rig with IK knees and elbows, walk, run, jump, land and swing cycles, and pose blending. He is drawn 1.5x larger on a paper aura so he stands out.
5. **Render pipeline:** *"draw everything with Phaser / Canvas2D and then convert it to ASCII"*. The game draws vector strokes into an offscreen buffer, and a post-process matches each character cell (4x6 samples, ridge-thinned) to the nearest glyph template. Two characters per world cell.
6. **Drawing names:** chosen from a word list, inanimate things only. The player can never create life.
7. **Solid body, hollow head:** the stickman (and every townsfolk) keeps a hollow round head, while the torso and limbs are solid: torso 2 characters wide, limbs 1. Solid ink carries a buffer-only marker, so the converter never thins it and prints it as `#`; the thin edges of solid shapes stay blank. On far slices, figures fall back to thin grey lines.
8. **20 stickman models:** the same figure for all of them, each filled with its own character. At first these were letters and digits; that was changed to unusual symbols, never letters or digits: `§ ¶ ¤ ± ÷ ‡ ‰ ♦ ♠ ♣ ♥ ◊ ∞ ≈ ≡ ⊕ ⊗ ☼ ※ ⌘`. The Latin-1 ones come from Courier Prime; the rest are drawn by hand in the glyph atlas so they look the same on every platform. You pick a model in a gallery drawn by the ASCII renderer (from the title screen, a new game, or settings). The model index travels through the buffer in the marker's green channel. Each townsfolk wears a different model.
9. **Thin stickman, from the player's own drawing:**
   - **Proportions:** a big round hollow head (about 30% of the height), a long torso, straight arms leaving it just below the neck and dropping a little (wider than the legs), and straight legs in an upside-down V. There are no hands or feet.
   - **One character thick:** every body line is exactly one character thick. Limbs are rasterised cell by cell (one cell per row, or per column), rounded symmetrically, and drawn as a single line when nearly straight.
   - **Rows:** at 1.5x the parts land on whole rows: head 3, neck 1, torso 3, legs 3.
   - **Head:** the hollow head is a pencil outline fitted to the character grid, drawn crisp on the buffer samples, so the renderer converts it to ` .---. ` / `(     )` / ` '---' `.
   - **Townsfolk:** they keep their hats, hair, glasses and beards; clothes only show on the far, pencil-line figures.
10. **Economy and danger:** an ink economy (pencil lead fades; pen ink is permanent) and real-time combat with physics.

## Original design (approved plan, in Portuguese)

### Premissa
Nas últimas páginas de um caderno escolar esquecido, um stickman rabiscado herda a fazenda do avô, Paper Acres, ao lado da cidadezinha de **Marginton**, que fica na linha de margem da folha. Páginas do caderno da cidade foram arrancadas (é o objetivo de longo prazo: "Mend the Notebook"), e no fundo da mina **The Inkwell** vive **The Eraser**, que apaga o mundo aos poucos.

### Metas / não-metas / anti-metas
- **Metas:** um ciclo de fazenda completo (plantar, regar, colher, vender, melhorar), uma cidade viva com NPCs, um mecanismo de fatias que faça sentido na jogabilidade (fileiras de plantação, rios, pontes, esquivar trocando de fatia), um desenho que pareça mágico e combate físico satisfatório. Deve rodar bem no celular.
- **Não-metas (v1):** romance/casamento, multiplayer, criar seres vivos desenhando, editor de mapas.
- **Anti-metas:** o ASCII gerado não se parecer com o que foi desenhado; queda de FPS no celular; texto ilegível em telas pequenas; game over punitivo (desmaiar só custa um pouco de ouro/itens, como no Stardew).

### Mundo em fatias (o núcleo)
- O mundo é um grid 3D de células: **X** colunas × **Y** linhas × **Z** fatias. Superfície: ~480 × 48 × 12. Cada célula mede 12×20 px, e cada linha cai sobre uma pauta preta fina do caderno.
- **Renderização em pilha:** a fatia atual fica em escala 1 e em tinta escura. As fatias z+1…z+5 são desenhadas atrás, com escala `1/(1+k·0.35)` em direção a um ponto de fuga no horizonte (~30% do topo), cada vez mais leves (glifos menos densos e pontilhado, ver Visual). A fatia z−1 aparece só como um fantasma grande, em pontilhado esparso, durante a transição. Atrás de tudo, um plano de fundo com montanhas, sol/lua e nuvens em ASCII, com parallax.
- **Trocar de fatia (W/S, ↑/↓):** só é permitido se a caixa do stickman couber na fatia de destino. Degrau de até 1 célula sobe automaticamente; se for mais alto, ele bate e volta. Se o chão estiver mais baixo, ele cai. A câmera anima um `zCamera` contínuo de z para z±1 em ~220 ms (efeito de zoom).
- **Colisão só na fatia atual.** Inimigos, projéteis e objetos também vivem em fatias. Trocar de fatia é uma esquiva.
- **Layout (X × Z):** Fazenda (X 0–150): a estrada em z0, fileiras de plantação em z1–z5 (cada fatia é uma fileira), casa/celeiro em z6–z7, riacho em z8, colinas e floresta em z9–z11. Cidade (X 190–330): rua em z2, fachadas com portas em z3, praça e fonte em z5, beco em z7. Floresta/lago (X 330–420). Montanha com a entrada da mina (X 420–480). Portas levam a interiores (mapas pequenos de 1–3 fatias).
- Obstáculos pensados para o desenho: o riacho sem ponte, um penhasco que pede uma escada, uma ravina na floresta, um lago (barco).

### Visual — estritamente bicolor
- **Só duas cores no jogo inteiro, menus incluídos:** bege-claro (`#efe4c8`) e preto. Não há cores de caneta nem transparência para criar tons. Tons intermediários vêm de recursos de ASCII:
  - densidade de caracteres (`#` → `=` → `:` → `.`)
  - pontilhado (dithering ordenado)
  - células invertidas: fundo preto com glifo bege
- **A folha:** pautas pretas finas (~1 px) alinhadas às linhas do mundo e margem como uma linha preta fina à esquerda. Três furos de fichário, dobras em linha pontilhada, borrões de borracha e a textura do papel são feitos com pontinhos pretos esparsos.
- Glifos em fontes monoespaçadas embutidas na pasta. Cada célula tem um leve tremor/rotação (hash determinístico) para parecer feito à mão, e um "boil" de traço a ~6 fps, desligável.
- **Profundidade sem cinza:** as fatias ao fundo, além de menores, usam glifos mais leves (cada caractere troca por um de menor densidade) e perdem células num padrão pontilhado conforme a distância. Assim elas parecem desbotadas sem nenhum tom de cinza.
- **Leitura sem cor:** água é `~`; perigo e vida são `!` e `<3`, piscando; a seleção é a célula invertida; o que se pode pegar ou usar tem um contorno pontilhado.
- **Dia/noite:** o entardecer cobre o céu com hachura ASCII progressiva. À noite a página **inverte** (fundo preto, glifos bege), com um raio "normal" ao redor de lanternas e janelas. A troca usa uma varredura pontilhada, sem esmaecimento por transparência.
- Clima em ASCII: chuva `/ ' ,`, neve `* .`, folhas caindo no outono, vento.

### Stickman e controles
- Esqueleto vetorial (cabeça, tronco, braços e pernas em 2 segmentos) com animação procedural (andar, correr, pular, usar ferramenta, golpear, nadar, subir escada). A cada quadro ele é **rasterizado em ASCII** numa sub-grade fina (meia célula) pelo mesmo algoritmo do desenho, então a animação é fluida e continua sendo ASCII puro.
- Em golpe forte ou queda, vira ragdoll (Matter, com juntas) e depois se levanta.
- **Teclado/mouse:** A/D andar, W/S trocar de fatia, Espaço pular, Shift correr, clique esquerdo usar ferramenta/atacar (mira pelo mouse), clique direito/E interagir, Q desenhar, 1–9 e roda do mouse para a hotbar, Tab/I abrir o caderno (menus), M mapa, Esc pausa.
- **Toque:** joystick virtual à esquerda (horizontal anda; um movimento rápido para cima/baixo troca de fatia), botões à direita (Pular, Usar/Atacar com mira arrastando, Interagir contextual, Desenhar), hotbar tocável. Os botões são só contorno preto, sem preenchimento translúcido. Opções de canhoto, tamanho e posição dos botões.
- **Gamepad:** suporte básico pelo Phaser.

### Desenho (a habilidade-assinatura)
1. **Sketchpad:** uma página de caderno em tela cheia com um grid visível (até 24×14 células). Ferramentas: lápis, caneta, borracha, desfazer, limpar e um balde de preenchimento (padrão `:` ou `#`).
2. **Algoritmo traço→ASCII:** os traços são guardados como polilinhas. Para cada célula, o algoritmo junta os segmentos que passam por ela e calcula a direção dominante e a posição:
   - `-`, ou `_` se o traço estiver perto da base da célula; `|`; `/`; `\`
   - cruzamentos viram `+` ou `x`; células densas com várias direções viram `#`
   - pontas e curvas fechadas viram `o`/`O`; pontos soltos viram `.`
   - cantos viram `,` `` ` `` `'`
   
   A prévia ASCII aparece ao vivo enquanto você desenha.
3. **Lista de palavras (só inanimados):** aparecem as palavras desbloqueadas, com as "melhores apostas" no topo. Um classificador de forma olha proporção, densidade, se o contorno é fechado, simetria e linhas dominantes. Exemplo: um traço longo e horizontal sugere Bridge/Plank; alto e fino sugere Ladder/Spear; redondo sugere Boulder/Wheel; uma caixa sugere Crate/Chest.
4. **Materialização:** o objeto mantém a aparência ASCII do desenho e ganha um **corpo físico com a forma do desenho** (as células viram retângulos agrupados num corpo composto do Matter). Ele cai e assenta no mundo, então uma ponte mal desenhada pode não alcançar o outro lado.
5. **Economia de tinta:**
   - **Lápis** (grafite, barato, vem do carvão do forno): o objeto é temporário e pode ser apagado. Ele é desenhado com uma fonte de traço mais fino e, ao longo de 3 dias, perde células em pontilhado até sumir.
   - **Caneta** (tinta do Ink Press, feita de cogumelos inkcap e frutinhas, ou comprada): o objeto é permanente e tem traço cheio.
   - Custo = células preenchidas × multiplicador do tipo. A borracha devolve 50%.
   - Palavras novas vêm em "word cards": compradas na papelaria e na biblioteca, recebidas de NPCs pela amizade, encontradas na mina ou nas páginas restauradas.
6. **Palavras (~40), por categoria:**
   - **Estrutura:** Bridge, Plank, Ladder, Stairs, Platform, Wall, Fence, Pillar, Shelter, Sign (o jogador escreve o texto)
   - **Física:** Crate, Boulder, Ball, Wheel, Cart, Boat, Raft, Balloon, Umbrella (planar e se abrigar da chuva), Spring, Anchor, Rope (corrente de juntas entre dois pontos), Seesaw
   - **Ferramenta:** Watering Can, Hoe, Axe, Pickaxe, Fishing Rod, Bucket, Lantern, Sprinkler, Scarecrow
   - **Combate:** Sword, Hammer, Spear, Shield, Boomerang, Bomb
   - **Casa/decoração:** Chair, Table, Bed, Lamp, Painting, Flower Pot, Clock
   
   Desenhos podem ser dados de presente aos NPCs, que reagem conforme a palavra e o capricho.

### Fazenda
- Ferramentas (enxada, regador, machado, picareta, foice, vara de pescar), com melhorias em 3 níveis no ferreiro (cobre, ferro e ouro, cada nível aumentando a área).
- Arar → plantar → regar → crescer por dias → colher. 16 culturas (4 por estação), árvores frutíferas, ervas daninhas, pedras e galhos para limpar, coleta silvestre e baú de envio (pago na manhã seguinte).
- Estações de criação: bancada, forno de carvão (madeira → carvão → grafite), Ink Press (tinta) e pote de conservas. Baús para guardar coisas.
- Energia (gasta em ações, recuperada comendo ou dormindo) e HP para o combate.
- Animais **comprados** do rancheiro (o jogador não cria vida): galinhas, vacas, cabras e ovelhas, em galinheiro/celeiro construídos pelo carpinteiro. Eles dão ovos, leite e lã.

### Cidade e NPCs
~12 NPCs com rotina diária, diálogos por estação, clima e nível de amizade, presentes amados e odiados, aniversários e 2 cenas de coração cada:
- Mayor Quill (prefeito)
- Ada Inkwell (papelaria: tinta e word cards)
- Clem (mercado/sementes)
- Gus (ferreiro)
- Dot & Dash (carpinteiros gêmeos)
- Rosa (rancheira)
- Old Bram (pescador)
- Ms. Rule (professora/biblioteca)
- Dr. Sepia (clínica)
- Hank (café)
- Pip (criança que adora rabiscos)
- Wren (artista viajante que ensina palavras raras)

Também: quadro de pedidos, correio e um festival por estação (Doodle Fair com concurso de desenho na primavera, Lantern Night no verão, Harvest Weigh-in no outono, Snow Sketch no inverno).

### Vida selvagem e pesca
Coelhos, pássaros, borboletas, sapos, cervos e corvos (que comem plantações e são espantados pelo Scarecrow), com IA leve por fatia. Pesca com um minijogo de barra no riacho, no lago e na mina, ~12 peixes.

### Combate em tempo real com física (Matter.js do Phaser)
- Armas são corpos Matter presos à mão do stickman por uma junta. O golpe aplica torque na direção da mira, e o **dano vem do impulso do impacto** (velocidade relativa × massa). Por isso um martelo pesado é lento mas forte, e uma espada é rápida.
- Escudo bloqueia, empurrar inimigos de penhascos ou em espinhos funciona, uma pedra desenhada e rolada esmaga, bombas dão impulso radial e quebram blocos frágeis.
- **The Inkwell (mina):** 30 andares gerados proceduralmente a partir de uma semente, cada um com 5 fatias, buracos e escadas para descer, e elevador a cada 5 andares. Tem minério (cobre, ferro, ouro, grafite, inkstone) e inkcaps.
- **Inimigos:** Smudge (borrão que quica), Scrawl Bat (voa em zigue-zague), Paperclip Spider, Eraser Mite (apaga seus desenhos), Crumple (bola de papel que rola), Ink Golem (pesado, empurra). Eles podem trocar de fatia.
- **Chefes:** andar 10 Coffee Stain, andar 20 Scissor Knight, andar 30 The Eraser (apaga células do terreno durante a luta).
- Desmaiar: acorda na clínica e perde um pouco de ouro e de itens. Nunca há game over.

### Tempo e progressão
- Dia das 6h às 2h. A duração do dia é configurável (padrão ~14 min reais). 4 estações de 28 dias (14 numa opção de novo jogo), clima sorteado com semente.
- **Mend the Notebook:** 6 páginas arrancadas com "bundles" de itens. Cada uma restaurada destrava algo no mundo: a ponte permanente para a floresta, o elevador da mina, uma estufa, o atalho para a montanha, um ônibus para o "deserto da contracapa" (se der tempo, senão uma área bônus menor) e a cena final.

### Áudio (WebAudio, tudo sintetizado, sem arquivos)
- **Música generativa com semente:** folk/lo-fi com cordas dedilhadas (Karplus-Strong), kalimba, piano suave e baixo. Temas por estação, hora do dia, cidade, mina (tenso) e luta de chefe, com transições cruzadas.
- **Efeitos:** lápis riscando enquanto desenha (ruído filtrado modulado pela velocidade do traço), passos em papel, pulo, enxada, água, moedas, virar de página nos menus, borracha, impactos de papelão/tinta, galinhas, sinos da cidade.

### Configurações e qualidade de vida
- **Configurações:** volumes (geral, música, efeitos), duração do dia, escala da interface/texto, tremor e boil dos traços, tremor de tela, número de fatias desenhadas (2–6), qualidade automática (dinâmica pelo FPS), layout de toque, dicas de controle, redução de movimento, pausar ao perder o foco.
- **Qualidade de vida:**
  - salvamento automático toda manhã, 3 slots, exportar/importar o save em JSON
  - menus em forma de caderno com abas: inventário, habilidades/palavras, mapa ASCII de cima com as fatias, calendário, diário de missões, relações, coleções e configurações
  - coleta automática num raio, ação repetida ao segurar o botão, ordenar o inventário, dicas contextuais e tutorial guiado nos primeiros dias

---

