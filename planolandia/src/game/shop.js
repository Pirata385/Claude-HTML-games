/* Planolândia — lojas. Cada item: id, nome, preço, descrição e o que entrega ao salvamento. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  const teo = (id, preco) => ({
    id, preco,
    get nome() { return 'Teorema: ' + PL.TEOREMAS[id].nome; },
    get desc() { return PL.TEOREMAS[id].desc + ' (custa ' + PL.TEOREMAS[id].custo + ' Postulado' + (PL.TEOREMAS[id].custo > 1 ? 's' : '') + ')'; },
    give: (st) => { st.teoremas[id] = true; },
  });

  const SHOPS = {
    pentagono: [
      { id: 'mapa_bosque', nome: 'Mapa do Bosque', preco: 30, desc: 'Mostra no mapa todas as salas do Bosque dos Cones, até as que você ainda não visitou.', give: (st) => { st.mapas.bosque = true; } },
      teo('ima', 60),
      teo('angulo_reto', 90),
      teo('pitagoras', 140),
      { id: 'frag_loja', nome: 'Fragmento de Lado', preco: 160, desc: 'Um segmento que o Pentágono jura ter sido de um decágono. Junte quatro para ganhar um Lado.', give: (st) => { PL.Save.addFrag(st); } },
    ],
  };

  const Shop = {
    sold(st, id) { return !!st.flags['buy_' + id]; },
    item(shop, id) { return (SHOPS[shop] || []).find((i) => i.id === id) || null; },
    buy(st, shop, id) {
      const it = Shop.item(shop, id);
      if (!it) return { ok: false, why: 'inexistente' };
      if (Shop.sold(st, id)) return { ok: false, why: 'vendido' };
      if (st.vert < it.preco) return { ok: false, why: 'saldo' };
      st.vert -= it.preco;
      st.flags['buy_' + id] = true;
      it.give(st);
      return { ok: true, item: it };
    },
  };

  PL.SHOPS = SHOPS;
  PL.Shop = Shop;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
