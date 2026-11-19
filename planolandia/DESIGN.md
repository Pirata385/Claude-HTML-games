# Planolândia — Fora do Plano · documento de design

Plano aprovado em 2026-11-19. O Marco 1 está implementado; os demais são o roteiro.

## Intenção

Um metroidvania de plataforma 2.5D em pixel art cartunesca com animação procedural, para computador e celular.

- **A ideia central:** o mundo é 3D de verdade, mas o Quadrado de Planolândia só enxerga a fatia 2D na profundidade em que está. Andar para frente e para trás muda a fatia, então formas aparecem, se transformam e somem. O terreno não muda; muda a perspectiva.
- **Combate:** dinâmico e em tempo real, inspirado em Hollow Knight.
- **Progressão:** habilidades novas a cada região, chefões com mecânicas próprias e, no fim, a entidade que o trouxe.

Pedidos do autor:
- metroidvania aberto;
- 7 regiões com 8 chefões ou mais;
- uma sessão por marco, com retorno do autor entre eles.

## Abordagens consideradas

| Opção | Por que sim / não |
| --- | --- |
| **Phaser 4.2.1 + motor de fatias próprio** (escolhida) | Cenas, câmera, multitoque, tweens, partículas, escala e WebGL em lote prontos. A física é própria de qualquer forma, porque nenhum motor corta sólidos 3D. |
| PixiJS v8 | Mais leve, mas exigiria reescrever cenas, entrada e câmera, sem ganho. |
| Canvas 2D puro | Caminhos antisserrilhados borram a pixel art; mais lento no celular. |
| Three.js com plano de corte | O corte viria de graça, mas brigaria com o visual 2D e com a física 2D. |

O mundo usa **sólidos analíticos cortados matematicamente**, e não voxels. Só assim a esfera vira um círculo que cresce suavemente e uma barra inclinada vira uma plataforma que desliza. Os tipos de sólido são:
- prisma extrudado em z;
- *loft* (um retângulo que se transforma em outro ao longo de z);
- fecho convexo genérico com qualquer rotação 3D;
- esfera, cilindros e cones.

## Lore

- **O Quadrado:** professor de geometria em Planolândia, homenagem a "A. Square", de Abbott. Tem espessura zero, por isso só percebe o próprio plano. O toque da entidade deixou nele uma *dobra*: ele pode deslizar na perpendicular.
- **Espaçolândia:** o mundo 3D, rachado pela *Ruptura*. Os Sólidos chamam o Quadrado de *Achatado* e o temem como fantasma, porque visto de lado ele some. Outros achatados perdidos aparecem pelo caminho:
  - Segmento, uma Linha anciã;
  - Pentágono, cartógrafo e mercador;
  - Agudo, um soldado isósceles enlouquecido.
- **O Desconhecido:** um ser 4D. Na luta final, aparece como fatias de fatias (4D → 3D → 2D) que mudam sem se mover.
- **Finais:**
  - voltar a Planolândia e ser preso por pregar a terceira dimensão (agridoce);
  - o final verdadeiro, com todos os Fragmentos.
- A hierarquia de Planolândia por número de lados entra como sátira, sem a parte machista do livro.

## Mecânica de fatias

- **Coordenadas:** x à direita, y para baixo, z para dentro da tela. Frente é z+ e trás é z−. A profundidade é contínua.
- **Corpo do jogador:** uma AABB 12×12 com espessura zero. A colisão é por SAT contra polígonos convexos e círculos. A física aceita:
  - rampas até ~53°;
  - plataformas atravessáveis por baixo;
  - degraus de 4 px;
  - correção de quina no ar;
  - empurrão para fora de sólidos dinâmicos e esmagamento.
- **Mover em z:** só é permitido se o corte no novo z não sobrepuser o corpo.
  - Até 6 px de subida são tolerados (elevadores) e há um empurrãozinho lateral contra superfícies curvas.
  - Quando bloqueado, a forma que impede pisca em vermelho.
  - Apoios que deslizam com z (lofts e barras giradas) carregam o Quadrado junto.
- **Leitura para o jogador:**
  - **Régua de Profundidade** no HUD, com marcas das passagens de profundidade, do chefão e dos ladrilhos que vão cair.
  - **Lábio 2.5D:** a fatia um pouco mais funda é desenhada deslocada para cima-direita, mostrando a matéria que continua dentro da tela. Um lábio fino indica que o sólido acaba logo.
  - Premonição pontilhada (±8) do que vai surgir: laranja à frente, azul atrás.
  - Contorno tremulante nas formas a menos de 7 de sumir.
  - Pintas de material como ruído 3D, que mudam ao atravessar a matéria, como mármore cortado.
- **Inimigos 3D:** só ferem e só são feridos quando cortam o plano do Quadrado. Os achatados vivem num único z.

## Mundo (7 regiões, metroidvania aberto)

```
              [6 Observatório Invertido]  (Reflexão + Garra)
                         |
[2 Bosque dos Cones]—(Garra)—[4 Cidade dos Sólidos]—(Ponto)—[5 Aqueduto de Fluxo]
        |                         | (Eco-Visão: passagem oculta)    |
[1 Borda do Plano]—(Investida)—[3 Minas Toroidais]——————————————————┘ (atalho)
        |
 (Ruptura, na sala de chegada; Giro do Plano) → [7 A Costura]
```

- **Ordem aberta:** depois da Investida, Bosque ou Minas. A Cidade abre pela Garra *ou* pela Eco-Visão.
- **Salas:** volumes 3D com posição no mundo (`pos`) e tamanho (`size`). Há saídas nas 4 bordas e saídas de profundidade (`near`/`far`). `World.validate` confere se as bordas e aberturas batem.
- **Pontos Fixos:** salvam, curam e viram ponto de retorno. A partir do Marco 3 vêm as Geodésicas (viagem rápida).
- **Morte:** os Vértices ficam no Contorno, deixado no local (ou no último chão seguro, se a morte foi em perigo). Morrer de novo antes de recuperá-lo faz perder os Vértices.

## Habilidades

| Origem | Habilidade | Estado |
| --- | --- | --- |
| Início | andar, pular, deslizar em profundidade, golpe de Aresta (4 direções, pogo), Foco | ✅ |
| Cubo Carcereiro | **Investida** (dash; ele se estica como uma linha) | ✅ |
| Mãe-Esfera | Garra de Vértice (agarrar a parede e pular dela) | Marco 2 |
| Verme Helicoidal | Eco-Visão (fatias fantasmas a ±48, segredos) | Marco 3 (o desenho fantasma já existe) |
| Agudo | Investida Profunda (dash em z que atravessa sólidos finos) | Marco 4 |
| Conselho Platônico | Ponto (projétil que gasta Geometria) | Marco 4 |
| Leviatã de Möbius | Reflexão (pulo duplo) | Marco 5 |
| O Projecionista | Giro do Plano (gira o plano de corte 90° no eixo vertical, trocando x por z) | Marco 6 |

Recursos:
- **Lados:** vida; começa com 5. 4 Fragmentos de Lado dão +1.
- **Geometria:** +11 por golpe; o Foco custa 33.
- **Vértices:** dinheiro.
- **Teoremas:** amuletos (Marco 2).

## Combate (valores do Marco 1, em `player.js`)

- **Movimento:**
  - corrida 118 px/s;
  - pulo −308 com corte de 42% ao soltar;
  - gravidade 980, com 55% no ápice;
  - coyote 0,09 s e buffer de 0,13 s.
- **Investida:** 275 px/s por 0,17 s, com recarga de 0,42 s e uma vez por salto.
- **Golpe:**
  - 0,26 s, ativo nos primeiros 0,11 s, com recarga de 0,33 s;
  - recuo de 95 px/s;
  - pogo −290.
- **Profundidade:** 86 px/s.
- **Dano recebido:** tira 1 Lado, com 1,15 s de invulnerabilidade, hitstop de 0,13 s e tremor de tela.
- Perigos (espinhos, poços) devolvem o Quadrado ao último chão seguro.

## Chefões

1. **Cubo Carcereiro** (Borda) ✅
   - **Formas e ataques:** o corte do cubo com rotação 3D anuncia o ataque. Quadrado → esmaga, com ondas de choque. Hexágono → gira cortando; só se foge pela profundidade. Triângulo crescendo → investida pela profundidade, com a "sombra" no chão.
   - **Núcleo:** fora do centro. Acertá-lo dá 4 de dano, a casca 1. 4 acertos no núcleo atordoam o chefão.
   - **Fase 2:** faixas de ladrilhos do chão avisam, piscando, e caem; surgem cubinhos.
   - **Fim:** ele se planifica em 6 quadrados.
2. **Mãe-Esfera** (Bosque): atravessa o plano como um círculo que cresce e encolhe; é preciso persegui-la pela régua. Divide-se em esférulas.
3. **Verme Helicoidal** (Minas, no escuro): segmentos que orbitam, mergulhando e emergindo de outras profundidades.
4. **Agudo, o Isósceles** (Cidade, intermediário): duelo espelhado contra outro achatado que também muda de profundidade.
5. **Conselho Platônico** (Cidade): cinco fases, uma por sólido de Platão.
6. **Leviatã de Möbius** (Aqueduto): fita de um lado só, com correntezas em z.
7. **O Projecionista** (Observatório): sombras 2D que ignoram a profundidade; a lâmpada fica num z certo.
8. **O Desconhecido** (Costura): fatias de tesserato, giros de plano forçados e a dobra final.
9. Opcional: **Rei Pentágono Dourado** (segredo da Cidade).

## Arte e animação

- **Resolução:** altura interna de 270 px; a largura vai de 432 a 640 conforme a proporção da tela. `pixelArt: true` e escala nítida.
- **Fatias:**
  - contorno de 1 px na cor de contorno do material;
  - lábio 2.5D;
  - realce nas bordas de cima e sombra nas de baixo;
  - faixas que escurecem para baixo nos blocos altos;
  - pintas de ruído 3D e enfeites determinísticos nas bordas superiores.
  - A camada estática vai para uma RenderTexture redesenhada só quando z (quantizado em 0,5) ou a sala mudam.
- **O Quadrado:**
  - molas de squash/stretch e de rotação;
  - olhos que piscam e olham;
  - bochechas;
  - perninhas com passos por fase;
  - gira a quina no golpe, estica na Investida e afina ao deslizar em profundidade, com rastros.
- **Inimigos:**
  - Esferóide: elipse com mola;
  - Cubo Sentinela: corte de fecho convexo girando;
  - Rabisco: traço fervilhante redesenhado a 12 fps.
- **Fundo:** céu de papel quadriculado e duas camadas de silhuetas de poliedros, com parallax horizontal e um leve deslocamento oblíquo com z.
- **Fonte:** pixel gerada em código, com largura variável e acentos, numa versão com contorno embutido.

## Controles

Teclado em dois esquemas (WASD + Q/E, Setas + A/S), mouse, gamepad (mapeamento padrão) e toque:
- joystick flutuante: andar, e profundidade no eixo vertical (ou mira, nas configurações);
- botão GOLPE: arrastar para cima ou para baixo mira o golpe;
- botões PULO, INVESTIDA, FOCO, ▲ de contexto, MAPA e pausa;
- paisagem obrigatória, com aviso para girar o aparelho.

## Arquitetura

- **Carregamento:** scripts clássicos no namespace `PL`, carregados em ordem por `index.html`.
- **Núcleo sem Phaser** (testado em Node): `core/` (geom3d, collide2d, physics, world), `data/`, e a lógica de `game/` exceto o desenho.
- **Interfaces principais:**
  - `G3.slice(prim, z)` / `G3.sliceInto(prim, z, shape)` devolve um polígono convexo ou círculo; o formato é `{type, n, pts, cx, cy, r, minX..maxY}`.
  - `room.query(z, minX, minY, maxX, maxY, mask, S, P)` devolve os sólidos ou perigos cortados na fatia.
  - `Phys.move(body, room, dt)`, `Phys.tryDepth(body, room, dz)`, `Phys.support`, `Phys.hazardAt`, `Phys.depenetrate`.
  - `World.defRoom({ id, region, name, pos, size, exits, build(B) })`. Os sólidos e entidades são declarados pelo Builder: `B.box`, `B.loft`, `B.cuboid`, `B.sphere`, `B.spikes`, `B.ent(...)`.
  - Inimigos estendem `PL.Enemy` com `sliceAt(z, out)`, `zRange()`, `update`, `draw` e (opcional) `hazards(pz, list)`. Registro em `PL.ENEMIES`.
  - `PL.Game` cuida de salas, transições, câmera, combate, morte, Contorno, Pontos Fixos e chefões. `HudScene` cuida do HUD e dos menus.
- **Salvamento:** `localStorage`, com 3 espaços em `planolandia.save.v1.N` e configurações em `planolandia.settings.v1`.

## Marcos

| Marco | Conteúdo | Estado |
| --- | --- | --- |
| 1 · Núcleo + Borda do Plano | motor de fatias, física, Quadrado, combate, 4 inimigos, 10 salas, Cubo Carcereiro → Investida, HUD, mapa, salvamento, toque, áudio | ✅ |
| 2 · Bosque dos Cones | ~12 salas, 3 inimigos, Mãe-Esfera → Garra de Vértice; NPCs e diálogos (Segmento, Pentágono), loja, Teoremas, Fragmentos | próximo |
| 3 · Minas Toroidais | escuridão e luz, Eco-Visão, paredes quebráveis, Geodésicas, Verme Helicoidal | |
| 4 · Cidade dos Sólidos | cidade hub com missões, Agudo → Investida Profunda, Conselho Platônico → Ponto, Rei Pentágono | |
| 5 · Aqueduto de Fluxo | fluidos, correntes em z, nado; Leviatã de Möbius → Reflexão | |
| 6 · Observatório Invertido | Giro do Plano (salas válidas nas duas orientações), quebra-cabeças de projeção; O Projecionista | |
| 7 · A Costura | vazamentos 4D, O Desconhecido, 2 finais, créditos, % de conclusão | |
| 8 · Polimento | teclas remapeáveis, acessibilidade, bestiário, conquistas, desempenho no celular, desafio de chefões | |
