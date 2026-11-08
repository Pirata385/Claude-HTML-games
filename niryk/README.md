# Niryk — Lendas do Planeta Partido

Um roguelike de ação em pixel art 2.5D, desenhado inteiro em **canvas 2D** (nenhuma imagem externa: cada sprite e textura é pintado em código ao abrir o jogo). A jogabilidade lembra *Soul Knight* e *The Binding of Isaac* (salas que se trancam até o último inimigo cair, chefes com padrões de projéteis, progressão permanente entre as runs); a direção de arte segue *Otherworld Legends*.

## Direção de arte

- **Heróis em estilo chibi**: cabeça grande, corpo pequeno, mapas de pixels de 20×19 com contorno escuro, ampliados 2× e animados em ciclo de caminhada. A Forma Dracônica da Emberian e Glub, o Mercador, seguem o mesmo estilo.
- **Inimigos, chefes, armas e itens** montados em volumes com **sombreamento cel automático**: cada volume é iluminado pela distância até a borda na direção da luz, quantizado em 4 tons com pontilhado ordenado, e recebe contorno escuro.
- **Cenário 2.5D**: paredes altas com face e topo; as que ficam à frente dos personagens são desenhadas por cima deles, com transparência quando escondem o herói. Árvores, pilares, lanternas, cristais, braseiros, juncos, estalagmites de gelo, rochas vulcânicas e costelas de colosso têm volume e **projetam sombras**.
- **Iluminação**: um mapa de luz multiplica a cena com uma ambientação escura por mundo, e lanternas, tochas, braseiros, cristais, lava, o portal, a fogueira, explosões e projéteis acendem focos de luz quente ou colorida. Projéteis e golpes brilham por cima da escuridão.
- **Chão pintado** em texturas contínuas (grama, pedras chanfradas, areia rachada, tábuas, lodo com poças, gelo rachado, basalto com veios de lava), com decalques, manchas e oclusão de ambiente junto às paredes.
- **Interface** no estilo do jogo: retrato do herói em moldura dourada, barras de vida e escudo em degradê, faixa de local com o botão de pausa, e botões redondos de habilidade em pincel e tinta.

Abra `index.html` no navegador (ou pelo menu da raiz do repositório). Funciona com mouse e teclado ou com toque no celular (de preferência na horizontal). O progresso fica salvo no `localStorage`.

## História

Niryk é um planeta partido em três camadas, cada uma com dois mundos possíveis: na superfície, o **Overworld** ainda vivo ou o **Pântano Sombrio** onde ele apodrece; no reflexo, o **Mundo Reverso** ou as **Cavernas de Gelo**; e no fundo, a **Wasteland dos Colossos** ou a **Caldeira Vulcânica**, onde o Núcleo Estelar ainda sangra lava. Cinco heróis descem pelas camadas para reacendê-lo.

## Controles

| Ação | Teclado e mouse | Toque |
| --- | --- | --- |
| Mover | WASD / setas | metade esquerda da tela (joystick) |
| Mirar e atacar | mouse + botão esquerdo (segure) | botão ⚔ (mira automática) |
| Esquiva | Espaço, Shift ou botão direito | botão » |
| Habilidades | Q e E: **toque** para usar com a mira automática, **segure** para mirar e solte para lançar | toque no botão, ou **arraste** o botão para mirar |
| Interagir, pegar, comprar | F ou Enter | botão F |
| Trocar de arma | R ou Tab | botão ⇄ |
| Mapa grande | M | toque no minimapa |
| Pausa | Esc ou P | botão II |

Enquanto uma habilidade está segurada, aparece no chão uma seta (investidas e disparos) ou uma área (golpes em área, armadilhas, invocações) mostrando onde ela vai cair. O ataque básico não muda.

## Configurações e conforto

No título, no acampamento e na pausa: **volume da música** e **dos efeitos** (a música ficou mais alta e mais cheia), **tela cheia** (também no botão do título e da pausa), tremor de tela, números de dano, câmera que acompanha o mouse, mira automática no toque, pausa automática ao sair da aba, contador de FPS e apagar o progresso. A pausa tem ainda **Status** (atributos atuais e equipamentos da run) e **Como jogar**. Passar o mouse sobre um equipamento no HUD mostra o que ele faz.

## Heróis

Cada herói tem 4 habilidades; leve **2 por run** (Q e E). Cada habilidade tem **3 passivas** que mudam como ela funciona: escolha **uma** delas ou use a habilidade **base**. A escolha é feita no **Grimório** (no acampamento ou no campo de treino).

| Herói | Arma preferida | Habilidades (passivas) |
| --- | --- | --- |
| **Emberian**, a Brasa Dracônica — mulher de sangue de dragão, com dois chifres e cauda | Tronco de Árvore (porrete) | **Forma Dracônica** — vira um dragão quadrúpede (Sopro Infernal · Coração de Brasa · Pouso Cataclísmico); **Rugido Ígneo** (Eco Flamejante · Rugido Ensurdecedor · Brado Protetor); **Investida Flamejante** (Rastro de Fogo · Dupla Investida · Impacto Final); **Pancada Sísmica** (Tremor Contínuo · Fissuras de Magma · Salto Colossal) |
| **Sylvar**, o Arqueiro da Lua Prateada — elfo dos bosques de prata | Arco Lunar | **Chuva de Flechas** (Flechas de Geada · Tempestade de Prata · Flecha Estelar); **Espírito da Floresta** (Guardião Ent · Enxame de Vagalumes · Espírito Curativo); **Passo Feérico** (Ilusão · Passos Duplos · Lâminas de Folha); **Raízes Prendedoras** (Espinhos Venenosos · Floresta Viva · Seiva Vital) |
| **Kestrus**, o Gavião das Tempestades — homem aviano | Penas-Lâmina | **Tempestade de Penas** (Espiral · Penas Bumerangue · Penas Afiadas); **Mergulho do Falcão** (Voo Planado · Garras Trovejantes · Mergulho Duplo); **Rajada de Vento** (Reflexão · Ciclone · Vento de Cauda); **Olho de Gavião** (Marca da Presa · Foco Absoluto · Caçador Veloz) |
| **Haldor**, o Corcel de Ferro — cavaleiro de um povo equino (orelhas, crina, cauda e cascos, mas mãos e rosto de gente) | Lança Trovejante | **Galope** (Estouro da Manada · Ferraduras de Fogo · Inabalável); **Coice** (Coice Sísmico · Coice Duplo · Casco Atordoante); **Relincho de Guerra** (Hino dos Bravos · Grito de Pânico · Fúria Equina); **Ferradura Trovão** (Corrente Elétrica · Trio de Ferraduras · Ferradura Ímã) |
| **Kazan**, o Ronin das Terras Quentes — samurai sem mestre do deserto, com chapéu de palha e katana forjada em lava | Katana Escaldante | **Iai: Corte Relâmpago** — avança cortando tudo no caminho (Sem Retorno · Corte Duplo · Lâmina Ardente); **Postura do Sol** — bloqueia e devolve o golpe (Reflexo Solar · Contra-ataque Ardente · Meditação); **Mil Cortes** (Tornado de Aço · Fio do Deserto · Vento Quente); **Areia Escaldante** (Miragem · Tempestade de Areia · Brasa Viva) |

As descrições completas estão no jogo (Grimório e perfil de cada herói) e em [`js/data.js`](js/data.js).

## A run

- **3 camadas × 3 níveis.** O terceiro nível de cada camada tem as salas normais **e** a sala do chefe no fim.
- Cada camada tem **dois mundos possíveis**. A primeira é sorteada; depois de cada chefe aparecem **dois portais** e você escolhe para qual mundo da camada seguinte descer.
- Cada nível é gerado na hora com **7 a 10 salas** (além da sala de entrada), ligadas por corredores. Delas, **2 ou 3** não são de inimigos — **Presente** (baú com equipamento e às vezes arma), **Upgrade** (escolha 1 de 3 bênçãos) e **Loja** (Glub, o Mercador) — e todas as outras são salas de inimigos, com 2 ou 3 ondas.
- Ao entrar numa sala de inimigos, as portas se fecham até a última onda cair. O portal para o próximo nível aparece na sala mais distante.
- **Ouro** só vale durante a run (lojas). **Cristais ✦** voltam com você e compram melhorias permanentes.
- Inimigos de elite (contorno dourado) aparecem com mais frequência nas profundezas.

### Dificuldades

Escolhidas no portal do acampamento. Cada uma é liberada ao **vencer uma run** na anterior.

| Dificuldade | O que muda | Cristais |
| --- | --- | --- |
| **Normal** | a descida como foi pensada | ×1 |
| **Difícil** | inimigos com +40% de vida, mais ágeis e com tiros mais rápidos, ondas um pouco maiores | ×1,4 |
| **Pesadelo** | +90% de vida, golpes 50% mais fortes, ondas maiores e mais elites | ×1,9 |
| **Lenda** | +150% de vida, dano dobrado, ondas enormes e chefes já na fase furiosa desde o início | ×2,5 |

### Mundos, inimigos e chefes

| Camada | Mundo | Inimigos | Chefe |
| --- | --- | --- | --- |
| 1 | **Overworld** | Gosmo, Cogumelo Esporeiro, Goblin Lanceiro, Lobo Cinzento, Arqueiro Kobold, Besouro-Rocha | **Mãe-Musgo**, Guardiã da Floresta Ancestral |
| 1 | **Pântano Sombrio** | Sapo Venenoso, Sanguessuga Gigante, Mosquito-Lâmina, Homem-Jacaré, Bruxa do Brejo, Planta Carnívora | **Gorgulho**, o Rei-Sapo do Pântano |
| 2 | **Mundo Reverso** | Diabrete Sombrio, Olho Flutuante, Cavaleiro Espelhado (montante, sem escudo), Morcego do Vazio, Mago Invertido, Aranha de Cristal | **Nyx'ara**, o Espelho Partido |
| 2 | **Cavernas de Gelo** | Yeti Filhote, Golem de Gelo, Espírito da Nevasca, Pinguim Lanceiro, Morcego Glacial, Cristal Vivo | **Glacia**, a Rainha do Inverno Eterno |
| 3 | **Wasteland dos Colossos** | Escorpião de Ferrugem, Verme da Areia, Golem de Sucata, Espírito de Poeira, Abutre de Ossos, Sentinela Colossal | **Kharun**, o Último Colosso |
| 3 | **Caldeira Vulcânica** | Salamandra de Fogo, Gosma de Magma, Diabrete de Cinzas, Golem de Obsidiana, Elemental de Fogo, Morteiro de Lava | **Ignavar**, o Dragão de Magma |

Cada chefe ganha novos ataques abaixo de metade da vida.

### Armas (25)

Tronco de Árvore, Arco Lunar, Penas-Lâmina, Lança Trovejante, Espada de Bronze, Funda de Pedras, Machado Duplo de Pedra, Besta de Repetição, Cajado de Brasa, Cajado Gélido, Martelo de Meteorito, Katana do Vento Cortante, Orbe Arcano, Tomo das Raízes, Mosquete Rúnico, Bacamarte de Cristal, Katana Escaldante, Leque de Guerra, Arpão de Osso, Tridente Abissal, Lanterna de Fogo-Fátuo, Chakram de Gelo, Canhão de Mão, Foice Sombria e Arco Vulcânico — corpo a corpo (golpes que também cortam projéteis), estocadas, giros, bumerangues, projéteis e feitiços, em quatro raridades. Leve duas e troque com R.

### Equipamentos (30)

Coração de Niryk, Casco de Tartaruga-Rocha, Botas de Couro de Wyvern, Garra Afiada, Manopla de Ferro, Aljava Encantada, Ampulheta Quebrada, Tambor de Guerra, Moeda da Sorte, Olho de Cristal, Amuleto de Brasa, Cristal de Gelo Eterno, Chifre do Trovão, Couraça de Cacto, Lanterna Espiritual, Anel Vampírico, Pena de Fênix, Capa das Sombras, Pedra-Ímã, Frasco de Orvalho, Máscara Oni, Sino dos Ventos, Escama de Dragão, Bússola Estelar, Gema de Sangue, Sandálias Aladas, Pergaminho Ancestral, Raiz Vital, Orbe da Tempestade e Adaga Envenenada. Os efeitos se acumulam durante a run.

## O acampamento (lobby)

- **Heróis**: fale com os outros quatro heróis em volta da fogueira para ver o perfil e trocar de personagem.
- **Grimório**: escolha as 2 habilidades e a passiva de cada uma.
- **Portal**: escolha a dificuldade e começa a run.
- **Códice**: armas, equipamentos, monstros e chefes; o que você ainda não descobriu aparece como silhueta.
- **Salão das Conquistas**: 26 conquistas, cada uma com recompensa em cristais.
- **Altar dos Ancestrais**: melhorias permanentes de status compradas com cristais (Vigor, Carapaça, Fúria, Precisão, Agilidade, Foco, Fortuna, Colheita Estelar e Segunda Chance).
- **Campo de Treino**: bonecos com medidor de dano por segundo, invocação de qualquer monstro já avistado, arsenal com as armas descobertas, recarga instantânea e modo invencível.

## Arquivos

```
index.html        página do jogo (canvas do mundo em baixa resolução + canvas da interface)
js/core.js        matemática, RNG com semente, entrada (teclado, mouse, toque), áudio sintetizado e música, save, tela cheia
js/data.js        conteúdo: heróis, habilidades e passivas, armas, equipamentos, inimigos, chefes, mundos, dificuldades, conquistas
js/gen.js         geração procedural dos níveis (salas, corredores, portas, obstáculos)
js/sprites.js     pixel art: pintor com sombreado e contorno automáticos, heróis chibi, inimigos, chefes, armas, itens, texturas
js/sprites2.js    pixel art do conteúdo novo: mundos Pântano, Gelo e Caldeira, seus chefes, armas, equipamentos e o Kazan
js/entities.js    colisão, herói, armas, projéteis, inimigos e IA, dano, efeitos de status, drops, efeitos visuais
js/bosses.js      os seis chefes
js/abilities.js   as 20 habilidades, as 60 passivas e a mira segurando o botão
js/render.js      cenário 2.5D: chão, paredes em duas passadas, sombras projetadas, mapa de luz, brilho
js/ui.js          HUD, minimapa e mapa grande, menus, configurações e controles de toque
js/game.js        laço principal, cenas (título, acampamento, treino, run), salas, lojas, portais e dificuldade
tests/run.js      testes de lógica em Node (contagens de conteúdo e regras de geração dos níveis)
tests/smoke.js    teste no navegador com Playwright: menus e configurações, todas as habilidades e passivas, mira segurando,
                  duas runs completas pelos seis mundos (Normal e Lenda), liberação de dificuldade, morte e toque
tests/sprites.html  folha com todos os sprites, para conferir a arte
```

## Testes

```
node niryk/tests/run.js      # sem dependências
node niryk/tests/smoke.js    # precisa do pacote playwright com o Chromium
```
