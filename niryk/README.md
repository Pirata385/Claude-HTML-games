# Niryk — Lendas do Planeta Partido

Um roguelike de ação em pixel art 2.5D, desenhado inteiro em **canvas 2D** (nenhuma imagem externa: cada sprite e textura é pintado em código ao abrir o jogo). A jogabilidade lembra *Soul Knight* e *The Binding of Isaac* (salas que se trancam até o último inimigo cair, chefes com padrões de projéteis, progressão permanente entre as runs); a direção de arte segue *Otherworld Legends*.

## Direção de arte

- **Heróis** com proporções mais realistas (cerca de 4,5 cabeças de altura), pintados pixel a pixel, com luz de borda vinda do alto à esquerda e pernas animadas em ciclo de caminhada.
- **Inimigos, chefes, armas e itens** montados em volumes com **sombreamento cel automático**: cada volume é iluminado pela distância até a borda na direção da luz, quantizado em 4 tons com pontilhado ordenado, e recebe contorno escuro.
- **Cenário 2.5D**: paredes altas com face e topo; as que ficam à frente dos personagens são desenhadas por cima deles, com transparência quando escondem o herói. Árvores, pilares, lanternas de pedra, cristais, braseiros, caixas e costelas de colosso têm volume e **projetam sombras**.
- **Iluminação**: um mapa de luz multiplica a cena com uma ambientação escura por mundo, e lanternas, tochas, braseiros, cristais, o portal, a fogueira, explosões e projéteis acendem focos de luz quente ou colorida. Projéteis e golpes brilham por cima da escuridão.
- **Chão pintado** em texturas contínuas (grama com pontilhado, pedras chanfradas, areia rachada, tábuas de madeira), com decalques e manchas de terra, além de oclusão de ambiente junto às paredes.
- **Interface** no estilo do jogo: retrato do herói em moldura dourada, barras de vida e escudo em degradê, faixa de local com o botão de pausa, e botões redondos de habilidade em pincel e tinta.

Abra `index.html` no navegador (ou pelo menu da raiz do repositório). Funciona com mouse e teclado ou com toque no celular (de preferência na horizontal). O progresso fica salvo no `localStorage`.

## História

Niryk é um planeta partido em três camadas: o **Overworld**, ainda vivo; o **Mundo Reverso**, seu reflexo invertido; e a **Wasteland dos Colossos**, onde os gigantes tombaram quando o Núcleo Estelar começou a se apagar. Quatro heróis descem pelas camadas para reacendê-lo.

## Controles

| Ação | Teclado e mouse | Toque |
| --- | --- | --- |
| Mover | WASD / setas | metade esquerda da tela (joystick) |
| Mirar e atacar | mouse + botão esquerdo (segure) | botão ⚔ (mira automática) |
| Esquiva | Espaço, Shift ou botão direito | botão » |
| Habilidades | Q e E | botões das habilidades |
| Interagir, pegar, comprar | F ou Enter | botão F |
| Trocar de arma | R ou Tab | botão ⇄ |
| Pausa | Esc ou P | botão II |

## Heróis

Cada herói tem 4 habilidades; leve **2 por run** (Q e E). Cada habilidade tem **3 passivas** que mudam como ela funciona: escolha **uma** delas ou use a habilidade **base**. A escolha é feita no **Grimório** (no acampamento ou no campo de treino).

| Herói | Arma preferida | Habilidades (passivas) |
| --- | --- | --- |
| **Emberian**, a Brasa Dracônica — mulher de sangue de dragão, com dois chifres e cauda | Tronco de Árvore (porrete) | **Forma Dracônica** — vira um dragão quadrúpede (Sopro Infernal · Coração de Brasa · Pouso Cataclísmico); **Rugido Ígneo** (Eco Flamejante · Rugido Ensurdecedor · Brado Protetor); **Investida Flamejante** (Rastro de Fogo · Dupla Investida · Impacto Final); **Pancada Sísmica** (Tremor Contínuo · Fissuras de Magma · Salto Colossal) |
| **Sylvar**, o Arqueiro da Lua Prateada — elfo dos bosques de prata | Arco Lunar | **Chuva de Flechas** (Flechas de Geada · Tempestade de Prata · Flecha Estelar); **Espírito da Floresta** (Guardião Ent · Enxame de Vagalumes · Espírito Curativo); **Passo Feérico** (Ilusão · Passos Duplos · Lâminas de Folha); **Raízes Prendedoras** (Espinhos Venenosos · Floresta Viva · Seiva Vital) |
| **Kestrus**, o Gavião das Tempestades — homem aviano | Penas-Lâmina | **Tempestade de Penas** (Espiral · Penas Bumerangue · Penas Afiadas); **Mergulho do Falcão** (Voo Planado · Garras Trovejantes · Mergulho Duplo); **Rajada de Vento** (Reflexão · Ciclone · Vento de Cauda); **Olho de Gavião** (Marca da Presa · Foco Absoluto · Caçador Veloz) |
| **Haldor**, o Corcel de Ferro — cavaleiro de um povo equino (orelhas, crina, cauda e cascos, mas mãos e rosto de gente) | Lança Trovejante | **Galope** (Estouro da Manada · Ferraduras de Fogo · Inabalável); **Coice** (Coice Sísmico · Coice Duplo · Casco Atordoante); **Relincho de Guerra** (Hino dos Bravos · Grito de Pânico · Fúria Equina); **Ferradura Trovão** (Corrente Elétrica · Trio de Ferraduras · Ferradura Ímã) |

As descrições completas estão no jogo (Grimório e perfil de cada herói) e em [`js/data.js`](js/data.js).

## A run

- **3 mundos × 3 níveis.** O terceiro nível de cada mundo tem as salas normais **e** a sala do chefe no fim.
- Cada nível é gerado na hora com **9 a 15 salas** (além da sala de entrada), ligadas por corredores. Delas, **2 ou 3** não são de inimigos — **Presente** (baú com equipamento e às vezes arma), **Upgrade** (escolha 1 de 3 bênçãos) e **Loja** (Glub, o Mercador) — e todas as outras são salas de inimigos, com 2 ou 3 ondas.
- Ao entrar numa sala de inimigos, as portas se fecham até a última onda cair. O portal para o próximo nível aparece na sala mais distante.
- **Ouro** só vale durante a run (lojas). **Cristais ✦** voltam com você e compram melhorias permanentes.
- Inimigos de elite (contorno dourado) aparecem com mais frequência nas profundezas.

### Mundos, inimigos e chefes

| Mundo | Inimigos | Chefe |
| --- | --- | --- |
| **Overworld** | Gosmo, Cogumelo Esporeiro, Goblin Lanceiro, Lobo Cinzento, Arqueiro Kobold, Besouro-Rocha | **Mãe-Musgo**, Guardiã da Floresta Ancestral |
| **Mundo Reverso** | Diabrete Sombrio, Olho Flutuante, Cavaleiro Espelhado, Morcego do Vazio, Mago Invertido, Aranha de Cristal | **Nyx'ara**, o Espelho Partido |
| **Wasteland dos Colossos** | Escorpião de Ferrugem, Verme da Areia, Golem de Sucata, Espírito de Poeira, Abutre de Ossos, Sentinela Colossal | **Kharun**, o Último Colosso |

Cada chefe ganha novos ataques abaixo de metade da vida.

### Armas (16)

Tronco de Árvore, Arco Lunar, Penas-Lâmina, Lança Trovejante, Espada de Bronze, Funda de Pedras, Machado Duplo de Pedra, Besta de Repetição, Cajado de Brasa, Cajado Gélido, Martelo de Meteorito, Katana do Vento Cortante, Orbe Arcano, Tomo das Raízes, Mosquete Rúnico e Bacamarte de Cristal — corpo a corpo (golpes que também cortam projéteis), estocadas, projéteis e feitiços, em quatro raridades. Leve duas e troque com R.

### Equipamentos (20)

Coração de Niryk, Casco de Tartaruga-Rocha, Botas de Couro de Wyvern, Garra Afiada, Manopla de Ferro, Aljava Encantada, Ampulheta Quebrada, Tambor de Guerra, Moeda da Sorte, Olho de Cristal, Amuleto de Brasa, Cristal de Gelo Eterno, Chifre do Trovão, Couraça de Cacto, Lanterna Espiritual, Anel Vampírico, Pena de Fênix, Capa das Sombras, Pedra-Ímã e Frasco de Orvalho. Os efeitos se acumulam durante a run.

## O acampamento (lobby)

- **Heróis**: fale com os outros três heróis em volta da fogueira para ver o perfil e trocar de personagem.
- **Grimório**: escolha as 2 habilidades e a passiva de cada uma.
- **Portal**: começa a run.
- **Códice**: armas, equipamentos, monstros e chefes; o que você ainda não descobriu aparece como silhueta.
- **Salão das Conquistas**: 18 conquistas, cada uma com recompensa em cristais.
- **Altar dos Ancestrais**: melhorias permanentes de status compradas com cristais (Vigor, Carapaça, Fúria, Precisão, Agilidade, Foco, Fortuna, Colheita Estelar e Segunda Chance).
- **Campo de Treino**: bonecos com medidor de dano por segundo, invocação de qualquer monstro já avistado, arsenal com as armas descobertas, recarga instantânea e modo invencível.

## Arquivos

```
index.html        página do jogo (canvas do mundo em baixa resolução + canvas da interface)
js/core.js        matemática, RNG com semente, entrada (teclado, mouse, toque), áudio sintetizado e música, save
js/data.js        conteúdo: heróis, habilidades e passivas, armas, equipamentos, inimigos, chefes, mundos, conquistas
js/gen.js         geração procedural dos níveis (salas, corredores, portas, obstáculos)
js/sprites.js     toda a pixel art (mapas de pixels e formas, com sombreado e contorno automáticos)
js/entities.js    colisão, herói, armas, projéteis, inimigos e IA, dano, efeitos de status, drops, efeitos visuais
js/bosses.js      os três chefes
js/abilities.js   as 16 habilidades e as 48 passivas
js/ui.js          HUD, minimapa, menus e controles de toque
js/game.js        laço principal, cenas (título, acampamento, treino, run), salas, lojas, portais e renderização
tests/run.js      testes de lógica em Node (contagens de conteúdo e regras de geração dos níveis)
tests/smoke.js    teste no navegador com Playwright: menus, todas as habilidades e passivas, uma run completa, morte e toque
tests/sprites.html  folha com todos os sprites, para conferir a arte
```

## Testes

```
node niryk/tests/run.js      # sem dependências
node niryk/tests/smoke.js    # precisa do pacote playwright com o Chromium
```
