# Range Club

Stand de tiro 3D estilizado, inteiramente no navegador. Abra `index.html` por um servidor HTTP estático (por exemplo, `python3 -m http.server 8765` na raiz do repositório).

## Conteúdo

- Bosque de cedros, campo aberto e pavilhão interno com iluminação, vegetação, cercas, abrigo, bancadas, placas de distância e bandeiras animadas.
- Revólver, pistola, espingarda com sete projéteis por disparo, arco recurvo e carabina. Modelos 3D, recuo, capacidade, dispersão, velocidade, balanço e recarga próprios.
- Papel com anéis de pontuação e marcas de impacto; latas com adesivos; garrafas com fragmentos. Latas e garrafas reaparecem após o acerto.
- Até quatro fotos JPG/PNG/WebP de até 10 MB, enviadas diretamente pelo painel de alvos e reduzidas a no máximo 640 px antes do armazenamento. A versão reduzida é salva em PNG, preservando as cores, e exibida sem clareamento ou influência da iluminação 3D. O painel mostra uma miniatura, remove diretamente a imagem exibida e permite ativar ou desativar o uso. Fotos substituem o papel e os adesivos das latas.
- Diversão: todas as armas, distância de 8 a 90 m, vento de 0 a 10 m/s, balanço e movimento dos alvos configuráveis; munição de reserva ilimitada.
- Torneio: 12 etapas de 12 a 78 m, 12 disparos por etapa, metas crescentes, alternância de alvos e movimento a partir da quinta etapa. Uma vitória rende `180 + pontos + 20 × etapa`; derrota não reduz créditos. Compras e etapas concluídas ficam salvas, rodadas em andamento não.
- PT, EN e JA; temas claro/escuro; efeitos de áudio sintetizados, pausa, zoom e controles de toque.

O botão de entrada fica imediatamente após a seleção do equipamento, antes das opções de alvo e balística, para permanecer acessível sem rolar a barra lateral em telas de desktop.

## Controles

Mouse aponta; clique dispara; R recarrega; Shift estabiliza enquanto houver fôlego; Espaço ou botão direito aproxima; Esc pausa. Em telas de toque, arraste o retículo e use os botões de disparo, recarga e zoom.

A carabina aproxima pela luneta 4×, com o cenário 3D visível através da lente e retículo próprio. As outras armas de fogo alinham alça e massa de mira. O arco permanece vertical durante a mira e a recarga; a flecha carregada desaparece ao ser lançada e retorna após recarregar.

Flechas e balas têm modelos 3D que partem da arma e acompanham a trajetória física. Rastros e um brilho discreto facilitam enxergar projéteis rápidos. Flechas acertando papel permanecem cravadas e acompanham os alvos móveis (até 16 por alvo).

O retículo mostra a direção com balanço antes da queda e do vento. Os projéteis percorrem segmentos 3D com gravidade e aceleração lateral; a colisão usa raycasting sobre cada segmento para não atravessar alvos. A flecha exige mais compensação de altura. A pontuação é de 10–50 no papel, 35 por lata e 40 por garrafa. Cada alvo pontua no máximo uma vez por disparo da espingarda.

## Estrutura e persistência

- `game.js`: interface, fotos, áudio, sessão, projéteis e progressão.
- `world.js`: geometria, iluminação, materiais, modelos e efeitos. Cenário estático agrupado em uma geometria para reduzir chamadas de desenho.
- `core.js`: regras e dados de armas.
- `i18n.js`: traduções.
- `styles.css`: layout e temas.
- `localStorage`: `rangeClub.save.v1` e `rangeClub.prefs.v1`.
- IndexedDB: `RangeClubDB` v1, store `photos`, chave `id`.

O utilitário `page/utils/backup.html` inclui essas preferências, progresso e fotos na exportação e restauração. Não existe backend nem envio de fotos. O Three.js 0.164.1 e as fontes são carregados por CDN; a primeira abertura requer conexão e suporte a WebGL.

## Validação

Com um servidor local ativo e Playwright disponível:

```sh
NODE_PATH=/caminho/para/node_modules node scripts/tests/range_club.mjs
NODE_PATH=/caminho/para/node_modules node scripts/tests/range_club_visuals.mjs
```

`RANGE_CLUB_URL` altera a origem padrão (`http://127.0.0.1:8765`). `PLAYWRIGHT_CHANNEL` altera o canal padrão (`chrome`). O teste usa um contexto isolado e verifica os cenários, armas, colisões, recarga/pausa, vitória, derrota, compras, persistência, uploads, exportação/restauração real do backup, traduções e layout móvel.

O teste `range_club_visuals.mjs` verifica a flecha visível em voo, pausa, recarga, flechas cravadas, balas e sete projéteis da espingarda, alinhamento das miras, acertos pela luneta e zoom em telas de toque.
