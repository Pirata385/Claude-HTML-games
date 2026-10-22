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

### Controles

| | Celular | Teclado e mouse | Gamepad |
| --- | --- | --- | --- |
| Andar | joystick (metade esquerda) | WASD / setas | analógico esquerdo |
| Mirar | automático, ou arrastando o botão | mouse | analógico direito |
| Ataque básico | ⚔ | clique / J | A / RT |
| Poderes | toque = mira assistida; arrastar = mira manual; voltar ao centro cancela | 1, 2, 3 (Q, E, R); segure para mirar | X, Y, B (segure + analógico direito) |
| Esquiva | ↯ | Espaço / K / botão direito | RB / LB |
| Pausa | ❚❚ | Esc / P | Start |

## Os poderes procedurais

Cada poder é **forma × elemento × modificadores × tier**, gerado a partir de uma semente:

- **15 formas:** projétil, lança, nova, sopro, campo, chuva, investida, órbita, sentinela, mina, muralha (cria voxels), bumerangue, gancho, salto e aura.
- **10 elementos**, cada um com um efeito próprio:

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

- **Modificadores:** teleguiado, ricochete, perfurante, explosivo, eco, rastro, vampírico, colossal, veloz, escavador, cristalizante, espiral, em cadeia, magnético e retorno. **Fractal** e **espelhado** existem só em poderes Anômalos.
- **Tiers:** Comum, Raro, Épico e **Anômalo** (dois elementos fundidos).

O dano de cada poder é calculado para que o valor esperado (dano por segundo + utilidade) bata com o orçamento do andar e do tier. Por isso qualquer combinação é jogável. Os nomes são gerados em português com concordância de gênero (*Lança Criogênica Ricocheteante*, *Beijo da Estrela Furiosa*). Cada poder também tem ícone e som próprios.

## O resto da torre

- **Criaturas:** oito arquétipos (bípede, quadrúpede, hexápode, aracnídeo, serpente, flutuante, alado e gelatinoso). Os stats, o traço, o ataque básico e a esquiva saem da anatomia. A animação é procedural no estilo Spore: os pés ficam plantados e dão passos com IK, as caudas e tentáculos balançam como correntes, e a cabeça segue o alvo. No nocaute, a criatura se desmonta em pedaços.
- **Voxels:** a arena inteira é destrutível. Blocos soltos desabam, núcleos de energia explodem em cadeia e alguns poderes erguem muralhas e cristais. Depois de 100 segundos, a arena começa a desmoronar pelas bordas.
- **Qualidade de vida:**
  - salvamento automático a cada andar e semente compartilhável;
  - Códice de seres, poderes e escaladas;
  - tutorial que não interrompe o jogo;
  - silhueta do jogador através de paredes e setas para inimigos fora da tela;
  - telegrafia vermelha nos ataques de área;
  - pausa automática ao trocar de aba;
  - modo canhoto, joystick fixo ou flutuante, e tamanho e opacidade dos botões ajustáveis;
  - qualidade gráfica, tamanho dos pixels e limite de FPS;
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
