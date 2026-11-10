# Filogênese — Sobrevivência Evolutiva

Um jogo de sobrevivência e evolução visto de cima, em canvas 2D, em português e inglês. Sua espécie acaba de sair da água: coma, faça amigos cantando e dançando ou cace, junte DNA e redesenhe o próprio corpo, geração após geração, até a sapiência.

É um jogo original no gênero de "evoluir uma criatura": todo o mundo, a fauna, a arte, a animação e o som são gerados por código próprio. Não há imagens nem áudios externos.

Abra `index.html` (ou escolha o jogo no menu da coleção). Funciona abrindo o arquivo direto, sem servidor.

## Como se joga

- **DNA** é a moeda e o progresso. Você ganha DNA fazendo amigos, abatendo criaturas, desenterrando fósseis, descobrindo espécies e cumprindo objetivos.
- **Postura social** (verde): use Canto, Dança, Encanto ou Pose perto de outra criatura. Ela mostra num balão o que quer ver; responda com a mesma habilidade antes de o tempo acabar. Quanto maior o seu nível naquela habilidade, mais rápido a amizade enche. Amigos suficientes tornam a espécie **aliada**.
- **Postura de combate** (vermelha): Mordida, Investida (atordoa), Cuspe (à distância, envenena) e Golpe (em área). Atacar agachado, ou uma criatura dormindo, dobra o dano. Abates suficientes **extinguem** a espécie.
- **Evoluir**: no seu ninho, chame um parceiro para abrir o editor. O corpo (porte, vértebras, larguras, cabeça, pernas) e a pele são livres; as partes custam DNA e, ao trocar, o valor da anterior volta.
- **Sobreviver**: a fome cai com o tempo. Herbívoros comem frutos, carnívoros comem carne e ovos, onívoros comem tudo. A vida volta sozinha fora de combate, bem mais rápido no seu ninho ou em ninhos aliados. Em água funda o fôlego acaba.
- **Bando**: a partir do nível cerebral 2 você chama aliados (ou membros da sua espécie) para andar com você. Eles lutam ao seu lado e repetem suas exibições sociais, o que acelera amizades.
- **Fim**: aos 1500 de DNA acumulado, no nível 5, o Despertar no ninho encerra a campanha com um título conforme seu estilo. Dá para continuar explorando depois.

### Controles

| Ação | Teclado e mouse | Toque | Gamepad |
| --- | --- | --- | --- |
| Andar | W A S D ou setas | arrastar no lado do direcional | analógico esquerdo |
| Correr | Shift | botão do raio | RT |
| Saltar (e planar, com asas) | Espaço | botão da seta | B |
| Agachar (furtivo) | C | botão do olho | L3 |
| Trocar social/combate | Q ou Tab | botão redondo | LB |
| Habilidades | 1 a 4 | os quatro botões | X, Y, RB, LT |
| Interagir | E | botão que aparece na tela | A |
| Mirar | clique na criatura | toque na criatura | R3 (próximo alvo) |
| Próximo alvo / soltar | R / X ou botão direito | botão da mira | — |
| Mapa, Filopédia, pausa | M, B, Esc | botões no canto | Select, —, Start |
| Zoom | roda do mouse | pinça com dois dedos | — |

Com alvo automático ligado, apertar uma habilidade sem alvo escolhe o mais próximo e, se ele estiver fora de alcance, a criatura anda até lá antes de agir.

## O que há no mundo

- **Mundo procedural por semente**: uma ilha de 15 360 unidades de lado com relevo, rios rasos, praia, campina, floresta, savana, deserto, pântano, tundra e montanhas intransponíveis. A mesma semente gera sempre o mesmo mundo e a mesma fauna.
- **8 famílias por mundo**, sorteadas entre 10 planos corporais (saltadores bípedes, corredores, cantores, matilheiros, couraçados, espreitadores de seis pernas, rastejantes sem pernas, catadores, anfíbios e colossos). Cada família tem raiz de nome, paleta, padrão de pele e formato de cabeça próprios.
- **Cerca de 30 espécies por mundo**, de 3 a 4 por família, mais **3 titãs** ancestrais. Cada espécie tem genoma, tamanho, cores levemente camufladas no seu bioma, voz sintetizada e nome comum e científico gerados.
- **12 nichos ecológicos**, que definem dieta e comportamento: pastador, frugívoro, ramoneador, cantor, oportunista, anfíbio, guardião, necrófago, emboscador, caçador de matilha, predador ápice e titã. Pastadores fogem em manada, guardiões avisam antes de atacar, necrófagos procuram carcaças, caçadores com fome saem para rondar ninhos de presas, e parte dos predadores é noturna.
- **Ciclo de dia e noite** (7 minutos) com escuridão e luz própria, vaga-lumes, espécies que dormem, e **chuva** ocasional.
- **46 ninhos**, **37 fósseis** (cada um libera uma parte) e **dois ninhos de migração**: nos níveis 3 e 4 sua espécie se muda para o interior, onde a fauna é mais perigosa.
- **71 partes** em 10 categorias (boca, olhos, pés, braços, chifres, cauda, dorso, glândulas, voz, adornos), com níveis de 1 a 4. Novas partes vêm de fósseis, de espécies aliadas ou extintas e de cada nível cerebral.

## Animação procedural

Nenhuma criatura tem quadros desenhados. O corpo é uma corrente de vértebras que segue a cabeça com limite de dobra; cada perna planta o pé no chão e dá um passo quando se afasta demais do ponto de repouso, alternando com o par, e o joelho sai de cinemática inversa de dois ossos. Criaturas sem pernas ondulam. Cauda abana, olhos piscam e seguem o alvo, a mandíbula abre, leques e babados se armam, asas abrem no salto. Como tudo deriva do genoma, qualquer criatura feita no editor já sai andando, cantando e mordendo.

## Configurações e conforto

- Volumes separados (geral, música, efeitos, ambiente).
- Qualidade gráfica automática (ajusta conforme o desempenho) ou fixa; zoom; partículas, sombras, chuva e tremor de tela desligáveis; contador de FPS.
- Controles de toque automáticos, lado do direcional, tamanho dos botões, correr segurando ou alternando, alvo automático, vibração.
- Idioma (português ou inglês, trocável a qualquer momento), tamanho da interface, dicas, números de dano, ícones de relação para quem não distingue as cores.
- Três espaços de salvamento, salvamento automático a cada 45 s e ao sair da aba, pausa automática ao perder o foco.
- Minimapa com radar, bússola para o ninho e para o objetivo, mapa-múndi com névoa de exploração e **viagem rápida** entre o seu ninho e ninhos aliados.
- **Filopédia**: famílias e espécies descobertas, com nicho, dieta, atributos, relação e as partes que cada uma pode render.
- Objetivos guiados, 20 conquistas e três dificuldades.

## Estrutura

```
index.html        página e HUD
style.css         estilos do HUD, telas e editor
js/util.js        matemática, RNG com semente, ruído, cores, eventos
js/settings.js    configurações persistentes
js/i18n.js        textos em português e inglês
js/icons.js       ícones vetoriais próprios (SVG e Path2D)
js/parts.js       catálogo de partes e cálculo de atributos
js/species.js     famílias, espécies, nichos, genomas e nomes
js/creaturedraw.js desenho procedural das criaturas
js/creature.js    corpo: espinha, pernas, animações
js/world.js       relevo, biomas, ninhos, fósseis, vegetação, colisão
js/fx.js          partículas e textos flutuantes
js/audio.js       efeitos, vozes, ambiente e música sintetizados
js/ai.js          comportamento das criaturas
js/game.js        estado, combate, socialização, interações
js/progress.js    níveis, objetivos, conquistas, cenas, saves
js/sprites.js     sprites procedurais do cenário
js/render.js      câmera, chão, cenário, noite, chuva, mapas
js/input.js       teclado, mouse, toque e gamepad
js/ui.js          HUD, avisos e gerenciador de telas
js/screens.js     menus, Filopédia, mapa, ajuda, final
js/editor.js      editor de criaturas
js/main.js        inicialização e laço principal
tests/            testes e galeria de criaturas
```

## Testes

```
node tests/run.js     lógica sem navegador: traduções, determinismo, campanha completa por um robô
node tests/smoke.js   navegador (Playwright): menu, editor, jogo, telas, toque
```

`tests/gallery.html` mostra todas as espécies de uma semente andando e fazendo suas animações (`?seed=7`).

Para desenvolvimento, `index.html?quick=O&seed=7` entra direto no jogo (H, O ou C escolhem a dieta).

## Limites conhecidos

- O áudio e o gamepad não são cobertos pelos testes automatizados: o código roda sem erros no navegador de teste, mas o som não foi ouvido nem o controle foi usado ali.
- O desempenho foi medido num navegador sem aceleração gráfica (cerca de 14 ms por quadro em 1280×720 com água à vista); em aparelhos reais não foi medido.
- A vegetação e os frutos colhidos não entram no save: os frutos voltam a crescer ao recarregar.
