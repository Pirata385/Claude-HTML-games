# Mutatrix — Laboratório de Vírus Mutantes

Jogo de laboratório em pixel art cartoon 2.5D, renderizado com **PixiJS** (WebGL), em português brasileiro. Você opera a Mutatrix, uma máquina retrô que fabrica vírus procedurais infinitos, e injeta as cepas num rato de laboratório, num robô biomecânico, numa planta ou numa ameba. As mutações se acumulam na mesma cobaia até ela virar uma aberração, ou colapsar de forma espetacular.

Abra `index.html` direto no navegador ou sirva a raiz do repositório com qualquer servidor estático (por exemplo `npx serve .`).

## Como se joga

1. **Escolha a cobaia.** Cada espécie tem custo, tolerância e temas que adora ou detesta.
2. **Monte o vírus na Mutatrix:** capsídeo (8 formas, cada uma puxa um tipo de mutação), fita genética com reagentes de 12 temas e potência de 1 a 3, mostradores de Virulência e Caos e uma semente. A mesma receita com a mesma semente gera sempre o mesmo vírus, e toda cepa tem um código (`MX-XXXXXX-XXXXXX-XXXXXX`) que pode ser copiado e colado.
3. **Sintetize e injete** (botão ou arrastando a seringa até a cobaia). Pode haver rejeição.
4. **Observe:** cada mutação aparece com animação e um cartão. Há 50 arquétipos (partes novas, mudanças de corpo e comportamentos), desenhados no material de cada espécie, em quatro classes: Inofensiva, Bizarra, Perigosa (ataca o vidro da câmara) e Destrutiva (dispara um dos 12 desastres do laboratório). Combinações de temas formam 16 sinergias.
5. **Instabilidade:** cada mutação soma pontos; aos 100% a cobaia colapsa num de 10 desfechos e paga uma bolsa pela bizarrice acumulada. Estabilizadores reduzem a instabilidade.
6. **Contratos, loja e coleção:** clientes procedurais pagam por cobaias com requisitos específicos (sempre cumpríveis com o que você já liberou); créditos compram encaixes, analisadores, capsídeos, reagentes, consertos e decoração; a Mutapédia registra tudo com marcos de recompensa; cobaias favoritas vão para potes na prateleira; a ficha de espécime pode ser baixada em PNG.

Atalhos: Espaço sintetiza ou injeta, 1 a 6 abrem os encaixes, E estabiliza, K contratos, L loja, C Mutapédia, P ficha, F tela cheia, Esc pausa, setas giram a cobaia.

## Direção de arte e áudio

- A cena é desenhada em resolução baixa e ampliada por um fator inteiro, com contorno de 1 pixel, sombreamento em três tons e paleta limitada. Tudo é procedural: cobaias, partes, vírus, laboratório, efeitos, ícones da interface, retratos dos clientes e o logotipo são gerados em tempo real pelo PixiJS. A fonte da cena é uma fonte em pixel 5x7 própria, com acentos.
- As cobaias são 2.5D: as partes ficam presas a pontos de um elipsoide que gira com a cobaia (arraste para girar) e são ordenadas por profundidade.
- Trilha generativa estilo bossa-lounge e efeitos sonoros sintetizados em WebAudio, sem arquivos de áudio.

## Configurações e qualidade de vida

Detalhe dos pixels (automático, alto, médio, baixo), limite de 30 ou 60 FPS, mostrar FPS, tremor de tela, clarões, movimento reduzido, tamanho do texto, animações rápidas, dicas, volumes separados, vibração, tela cheia, salvamento automático com exportação e importação por código. Layout em gaveta no celular em pé e painel lateral no celular deitado e no desktop.

## Estrutura

```
index.html          telas e carregamento dos scripts
style.css           interface em pixel art
vendor/pixi.min.js  PixiJS 8.6.6 (licença MIT em vendor/PIXI-LICENSE.txt)
js/rng.js           gerador com semente, hash e sorteio ponderado
js/data.js          temas, capsídeos, espécies, arquétipos, sinergias, colapsos, loja
js/words.js         textos e bancos de palavras
js/genetics.js      síntese de vírus, códigos de cepa, analisador
js/mutations.js     mutações concretas por espécie
js/subject.js       cobaias, injeção, instabilidade, sinergias, colapso
js/contracts.js     contratos procedurais e avaliação
js/economy.js       estado inicial, loja, consertos, Mutapédia, marcos
js/save.js          salvamento, migração, exportação
js/audio.js         música generativa e efeitos
js/render/pix.js    paleta, pincéis de pixel art, fonte 5x7, ícones e miniaturas
js/render/creature.js  cobaias 2.5D e partes
js/render/virus.js  vírus e frascos
js/render/lab.js    laboratório, máquina, câmara, seringa
js/render/fx.js     partículas, desastres, balões de fala
js/ui.js            interface (painel, cartões, modais)
js/main.js          laço, fluxo do jogo, entrada e renderização
tests/              testes da lógica (node --test) e teste de fumaça
```

## Testes

```
node --test mutatrix/tests/*.test.js
```

Cobrem determinismo do gerador e da síntese, códigos de cepa (ida e volta e detecção de erro), todas as combinações de arquétipo, espécie, tema e classe, instabilidade e colapso, contratos sempre cumpríveis, loja e marcos, salvamento e migração, ausência de emojis e cobertura da fonte em pixel.

O teste de fumaça abre o jogo num Chromium com Playwright, joga uma rodada e verifica que não há erros no console:

```
python3 -m http.server 8765        # na raiz do repositório
node mutatrix/tests/smoke.mjs http://localhost:8765/mutatrix/index.html
```
