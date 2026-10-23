# Xenospire — A Torre Infinita

Um jogo de luta em arena, isométrico e em pixel art, feito primeiro para celular. Seres de todos os cantos do universo sobem uma torre infinita no espaço, andar por andar, lutando com **poderes gerados proceduralmente**.

Abra `index.html` no navegador (direto do disco ou por qualquer servidor estático) ou escolha o jogo no menu da coleção.

## A lenda

> Ano 9.999.999. As estrelas estão se apagando. No vazio entre as galáxias flutua a **Xenospire**, uma torre sem topo. Seu zelador, **o Curador** (uma entidade teatral e burocrática feita de luz e formulários), convoca seres de todos os cantos do universo para subirem lutando. Cada andar é uma arena. No coração da torre, **o Tear** tece poderes novos com fios de realidade. Diz a lenda que quem chegar ao topo poderá reescrever o destino de sua estrela natal. O Curador garante que o topo está "logo ali".

## Como se joga

1. **Chegada:** escolha seu ser entre três gerados. Você pode re-sortear até 3 vezes ou digitar uma semente.
2. **O Tear:** escolha 1 entre 3 poderes, três vezes, para montar seus 3 slots.
3. **Versus:** veja quem você vai enfrentar e **que poderes cada oponente escolheu** (e quais recusou).
4. **Luta:** derrube o oponente ou empurre-o para fora da arena. Cair no vazio custa 20% da vida.
5. **Entre andares:** o Tear oferece três poderes novos, mais fortes. Você pode pegar um e trocar um slot, **reforçar** um poder seu para a força do andar seguinte, ou **desfiar** tudo para recuperar vida.

Os tipos de andar:

- **Andar comum:** duelo 1×1.
- **A cada 5 andares:** luta livre, em que todos lutam contra todos.
- **A cada 10 andares:** um **Guardião**, que é enorme, tem 4 poderes e entra em fúria com metade da vida.

A torre não tem fim. Quando você perde, a escalada acaba e vai para o Códice e para o histórico, junto com um epitáfio.

### Sala de Testes

No título, **Sala de Testes** leva a um salão do laboratório do Curador, separado das escaladas:

- **O Tear** no centro: teça poderes à vontade, filtrando por raridade, forma e elemento, com força de andar 1 a 50 e semente opcional. Cada resultado pode ser equipado em qualquer slot, com re-sorteios ilimitados.
- **Quatro manequins** em plataformas: parado, andarilho, esquivo e brigão (revida fraco). Eles nunca caem e mostram o **DPS** dos últimos 5 s.
- **Portal:** abre uma batalha de teste com 1 a 3 oponentes, andar e dificuldade à escolha. No fim da luta, você volta para a sala.
- **Terminal:** troca de ser (re-sorteio ilimitado ou semente).
- **Opções:** sem recarga, invulnerável e restaurar a sala.

Um botão contextual aparece perto de cada estação (no teclado: F).

### Controles

| | Celular | Teclado e mouse | Gamepad |
| --- | --- | --- | --- |
| Andar | joystick (metade esquerda) | WASD / setas | analógico esquerdo |
| Mirar | arrastar o botão, como um mini-joystick | mouse | analógico direito |
| Ataque básico | ⚔: tocar = automático; segurar = contínuo; arrastar = mirar | clique / J | A / RT |
| Poderes | tocar = mira assistida; arrastar = mira manual (a distância do arrasto define o alcance dos arremessos); voltar ao centro cancela | 1, 2, 3 (Q, E, R); segure para mirar | X, Y, B (segure + analógico direito) |
| Esquiva | ↯ | Espaço / K / botão direito | RB / LB |
| Interagir (Sala de Testes) | botão contextual | F | — |
| Tela cheia | ⛶ no título ou na pausa | ⛶ no título ou na pausa | — |
| Pausa | ❚❚ | Esc / P | Start |

Ao mirar, um indicador no chão mostra o alcance e a área de cada tipo de poder: faixa para disparos, cunha para sopros, arco tracejado e zona de queda para arremessos, círculo para áreas, seta para investidas e barra para muralhas. Poderes **carregáveis** ficam mais fortes quanto mais tempo você mira.

## Os poderes procedurais

Cada poder é **forma × elemento × modificadores × raridade**, gerado a partir de uma semente:

- **25 formas**, cada uma com seu tipo de mira:
  - **disparos:** projétil, lança, tiro de precisão, bumerangue, gancho, perfuratriz (atravessa e escava paredes), onda (corre pelo chão abrindo uma trincheira), erupção (fileira de espinhos de voxel) e redemoinho;
  - **cones:** sopro, rajada (escopeta) e tremor (abre cratera e atordoa);
  - **arremessos**, que passam por cima das paredes: granada, mina, campo, singularidade (buraco negro) e sentinela;
  - **áreas:** chuva e meteoro (cratera enorme);
  - **investidas:** investida e salto;
  - **em você:** nova, órbita e aura;
  - **muralha**, que cria voxels.
- **12 elementos**, cada um com um efeito próprio:

  | Elemento | Efeito |
  | --- | --- |
  | Plasma | queima |
  | Crio | deixa lento e congela |
  | Gravidade | puxa |
  | Vazio | rouba vida |
  | Bio | envenena |
  | Arco | atordoa e encadeia |
  | Cristal | gera escudo |
  | Sônico | empurra forte e destrói o cenário |
  | Cronos | atrasa o alvo |
  | Psi | marca o alvo para dano extra |
  | Terra | enraíza, cria rocha e destrói o dobro do cenário |
  | Luz | ofusca: o alvo causa 25% menos dano |

- **Modificadores:** teleguiado, ricochete, perfurante, explosivo, eco, rastro, vampírico, colossal, veloz, escavador, cristalizante, espiral, em cadeia, magnético, retorno, **carregável**, **curvo**, **subterrâneo**, **fragmentário** (minigranadas) e **retardado** (detona depois, mais forte). **Fractal** e **espelhado** existem só em poderes Anômalos.
- **Raridades:**
  - **Comum:** forma + elemento.
  - **Raro:** + 1 ou 2 modificadores.
  - **Épico:** dois poderes em um. Ao acertar, ao terminar ou ao conjurar, solta uma segunda carga: nova, campo, minas, muralha, buraco negro, chuva, sentinela, espinhos, estilhaços ou relâmpago (*Dardo Ígneo com Nova*).
  - **Anômalo** (raríssimo): Épico + dois elementos fundidos + um modificador anômalo.

As chances de Épico e Anômalo sobem com o andar. O dano de cada poder é calculado para que o valor esperado (dano por segundo + utilidade, incluindo a carga do Épico) bata com o orçamento do andar e da raridade. Por isso qualquer combinação é jogável. Os nomes são gerados em português com concordância de gênero (*Lança Criogênica Ricocheteante*, *Beijo da Estrela Furiosa*). Cada poder também tem ícone e som próprios; a moldura do ícone muda com a raridade, e o do Épico mostra a segunda carga no canto.

## O resto da torre

- **Criaturas:** oito arquétipos (bípede, quadrúpede, hexápode, aracnídeo, serpente, flutuante, alado e gelatinoso). Os stats, o traço, o ataque básico e a esquiva saem da anatomia. A animação é procedural no estilo Spore: os pés ficam plantados e dão passos com IK, as caudas e tentáculos balançam como correntes, e a cabeça segue o alvo. No nocaute, a criatura se desmonta em pedaços.
- **Visual:** pixel art em alta resolução, com brilho aditivo, luz projetada no chão, rastros, ondas de choque e uma assinatura visual própria para cada elemento.
- **Arenas:** de 88 a 112 voxels de lado, abertas, com poucos obstáculos bem espaçados, colinas baixas em terraços, ravinas nos temas orgânicos e, às vezes, uma fortaleza com portões largos no centro. Um minimapa mostra a arena e os lutadores. A IA navega por um mapa de distâncias e contorna paredes e buracos.
- **Voxels:** a arena inteira é destrutível.
  - As crateras saem irregulares, e meteoros podem furar até o vazio.
  - Os blocos racham antes de quebrar, e rachaduras se espalham pelo vidro, cristal e gelo.
  - Cada elemento deixa sua marca no chão (queimado, gelo, ácido, vazio, cristal).
  - Estruturas soltas caem como pedaços inteiros: pilares altos tombam para o lado do golpe, viram entulho e esmagam quem estiver embaixo.
  - Núcleos de energia explodem em cadeia, e alguns poderes erguem muralhas, espinhos e rocha.
  - Depois de 100 segundos, a arena começa a desmoronar pelas bordas.
- **Qualidade de vida:**
  - salvamento automático a cada andar e semente compartilhável;
  - Códice de seres, poderes e escaladas;
  - tutorial que não interrompe o jogo;
  - obstáculos ficam semitransparentes quando você passa atrás deles, e setas mostram inimigos fora da tela;
  - telegrafia vermelha nos ataques de área;
  - pausa automática ao trocar de aba;
  - modo canhoto, joystick fixo ou flutuante, e tamanho e opacidade dos botões ajustáveis;
  - tela cheia (no iPhone, que não permite tela cheia no navegador: Compartilhar → "Adicionar à Tela de Início");
  - qualidade gráfica (com ajuste automático: se a luta ficar lenta, a qualidade baixa sozinha), tamanho dos pixels e limite de FPS;
  - dificuldade, mira assistida, tremor de tela e pausa de impacto;
  - acessibilidade: reduzir flashes e movimento, códigos de elemento nos ícones e texto maior.
- **Som:** tudo é sintetizado com WebAudio. Isso inclui o som de cada poder, as vozes das criaturas, a "fala" do Curador e a música generativa de cada tema de andar.

## Estrutura

```
index.html        página do jogo (carrega os scripts em ordem)
style.css         interface
js/core/          sementes e RNG, matemática e projeção isométrica, eventos, armazenamento, textos
js/gen/           geradores: paleta, criaturas, poderes, arenas, falas do Curador
js/world/         mundo de voxels (dano, desabamento, raycast)
js/anim/          rig de animação procedural
js/game/          lutador, status, execução dos poderes, IA, batalha, escalada
js/render/        tela em baixa resolução, terreno, fundo, criaturas, ícones, efeitos, cena
js/io/            entrada (toque, teclado, gamepad) e áudio
js/ui/            configurações, cartas, HUD, telas
tests/            testes em Node (sem dependências)
```

Os módulos de lógica não tocam o DOM e rodam no Node. Os testes incluem centenas de lutas IA × IA simuladas.

## Testes

```
node --test xenospire/tests/*.test.js
```

## APK para Android

Um APK pronto para instalar está em [`releases/Xenospire-v1.0.apk`](releases/Xenospire-v1.0.apk). É um app nativo mínimo (uma `WebView` em tela cheia) que carrega os mesmos arquivos deste jogo — sem servidor, sem conexão.

Para instalar: baixe o `.apk` no celular, abra-o e permita "instalar app de fonte desconhecida" se o Android pedir (o APK é assinado com a chave de debug padrão do Android, não publicado na Play Store).

### Gerando o APK você mesmo

O projeto Android fica em [`android/`](android/). Ele embute uma cópia de `index.html`, `style.css` e `js/` em `android/app/src/main/assets/www/` — depois de editar o jogo, repita a cópia antes de gerar um novo APK:

```
cp -r xenospire/index.html xenospire/style.css xenospire/js xenospire/android/app/src/main/assets/www/
```

Com o Android SDK (`platform-tools`, `platforms;android-34`, `build-tools;34.0.0`) instalado e `ANDROID_HOME`/`local.properties` configurados, builde com:

```
cd xenospire/android
gradle assembleDebug
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.
