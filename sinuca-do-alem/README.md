# Sinuca do Além

Um roguelike de sinuca em 2.5D, num boteco assombrado. Cada mesa tem uma meta de pontos e poucas tacadas; entre as mesas você gasta moedas no balcão e escolhe por qual porta seguir. Em português, para desktop e celular (retrato ou paisagem), sem instalação e sem dependências.

Abra `index.html` num navegador moderno, ou sirva a raiz do repositório com qualquer servidor estático.

## Como se joga

- **A conta.** Cada mesa pede uma meta de pontos em um número fixo de tacadas (7 com o taco padrão). Bateu a meta, a mesa está vencida e as tacadas que sobraram viram moedas. Acabaram as tacadas antes disso, a noite acabou.
- **Pontos × multiplicador.** Cada bola encaçapada soma seus pontos. O multiplicador da tacada começa em 1 e sobe com:
  - combo: +1 por bola a mais na mesma tacada;
  - tabela: +0,5 se a bola tocou numa tabela antes de cair;
  - carambola: +0,5 se a bola tocou outra bola antes de cair;
  - sequência: +0,5 por tacada seguida com bola encaçapada.
- **Falta.** Encaçapar a branca corta a tacada pela metade e apaga a sequência.
- **Mesa limpa.** Se as bolas acabarem antes da meta, entra uma leva nova e você ganha 2 moedas.

Uma noite tem três atos de três mesas. A terceira mesa de cada ato é de um chefe com uma regra própria. Depois do terceiro ato dá para seguir num modo infinito.

## O que há no balcão

| Tipo | Quantos | O que faz |
| --- | --- | --- |
| Amuletos | 37 | Efeitos permanentes na noite (até 6 de cada vez; dá para vender). |
| Bolas especiais | 12 | Entram no seu saco de bolas e voltam em toda mesa: bomba, fantasma, ímã, ameba, chumbo, cristal, raio, fogo, camaleão, ouro, borracha e a Bola 8 Maldita. |
| Gizes | 10 | Uso único (até 3 no bolso): fogo, fantasma, trovão, triplo, pulo, fome, dourado, gigante, terremoto e o Giz do Tempo, que desfaz a última tacada. |
| Serviços | 2 | Polir uma bola (+20 pontos) ou tirá-la do saco. |

Depois do balcão você escolhe uma porta. Mesas mais esquisitas pagam prêmios melhores, e há 13 esquisitices: rebatedores de pinball, portais, caçapa dourada, gelo, poças, ventilador, engradados, hélice, caçapas tampadas, caçapas miúdas, buraco negro, mesa torta e apagão.

Há seis tacos para começar a noite (três liberados ao vencer atos), três dificuldades e sementes: a mesma semente gera a mesma sequência de mesas, portas e balcões. O botão **Do dia** usa a data como semente.

## Controles

| Modo | Mira | Força |
| --- | --- | --- |
| Estilingue (padrão) | Toque ou clique em qualquer lugar e arraste para trás | Distância do arrasto; solte para bater |
| Mira + força | Toque: arraste para girar o taco. Mouse: o taco segue o cursor | Toque: puxe a barra lateral e solte. Mouse: segure o botão e solte |

Teclado: `←` `→` miram (com `Shift`, ajuste fino), `Espaço` carrega e solta a tacada, `1`–`3` armam um giz, `Tab` acelera as bolas, `F` alterna a tela cheia, `Esc` pausa. A roda do mouse também gira a mira.

O botão da bolinha branca abre o **efeito**: para cima a branca segue depois da batida, para baixo ela volta, e para os lados muda o rebote na tabela.

## Configurações e conforto

- Tela cheia (onde o navegador permite), volumes separados de música e efeitos, vibração, tremor de tela, guia de mira, modo canhoto.
- Gráficos em Auto, Leve, Médio e Alto. No Auto, o jogo baixa a resolução sozinho se os quadros ficarem pesados.
- A noite é salva a cada tacada, no balcão e nas portas: dá para fechar a aba e continuar depois.
- Almanaque com tudo o que já apareceu nas suas noites.

## Estrutura

```
index.html          página e telas
css/style.css       interface (lousa, comanda, bolachas)
js/util.js          RNG com semente, formatação, armazenamento
js/data.js          bolas, amuletos, gizes, tacos, esquisitices, chefes, metas
js/physics.js       física das bolas (sem DOM)
js/render.js        desenho em canvas 2D com câmera em perspectiva
js/audio.js         efeitos e música sintetizados (Web Audio)
js/game.js          noite, mesas, pontuação, balcão, portas, salvamento
js/ui.js            HUD e telas em DOM
js/main.js          laço de quadros, entrada, tela cheia, qualidade
fonts/              Lilita One e Patrick Hand (SIL Open Font License)
tests/              testes da física
```

A mesa parada é pintada uma única vez numa camada fora da tela; por quadro só se desenham bolas, efeitos e taco. A física roda em passo fixo de 1/120 s, com subpassos conforme a bola mais rápida.

## Testes

```
node tests/physics.test.js
```

Cobrem caçapas, colisões, efeito, tabelas, caçapa tampada, bola fantasma, portais, a guia de mira, determinismo e 200 tacadas aleatórias numa mesa cheia de obstáculos (nada sai da mesa, nada vira `NaN`, toda tacada termina).
