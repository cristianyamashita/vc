# Lia — protótipo Blender

Primeiro personagem do Story Studio com malha suave e skinning. O acabamento é
de boneca estilizada; ainda não tem qualidade de personagem de longa-metragem.

## Refinamento de rosto e ombros

As mangas agora têm uma inclinação contínua, sem as esferas sobre os ombros.
Os olhos têm abertura amendoada, íris acompanhando a superfície ocular, pálpebras,
linha lacrimal e canto interno. O rosto ganhou órbitas, ponte nasal, narinas,
maçãs do rosto, queixo e lábios com arco superior e volume inferior. As orelhas
agora têm uma concha rebaixada, borda integrada e dobras internas suaves.
O cabelo usa uma divisão lateral, mechas achatadas sobrepostas, fios finos
acompanhando o penteado e pontas soltas nas têmporas. A parte de trás converge
para a trança. As órbitas foram aprofundadas levemente, preservando a abertura
amendoada e a íris. O rig e as 12 roupas mantêm os mesmos identificadores e controles.

## Ligação dos ombros

O tronco e os braços compartilham uma superfície soldada antes da aplicação dos
pesos. Peito, axila e ombro deformam com uma transição contínua entre os ossos do
peito e dos braços. Camisetas e mangas também são unidas antes do skinning.
As pernas são modeladas separadamente durante essa união para evitar soldar um
punho à coxa na posição de repouso; a sobreposição escondida no quadril usa os
mesmos pesos. As posições dos ossos e dos pontos de objetos nas mãos não mudaram.

## Arquivos

- `lia.blend`: fonte editável, esqueleto de 16 ossos, 12 roupas, câmera e iluminação.
- `lia.glb`: modelo para o navegador, com pesos e todas as roupas no mesmo arquivo.
- `rig.json`: posições de repouso e correspondência entre roupas e documentos.
- `lia-preview.png`: renderização de corpo inteiro no Blender.
- `lia-detail.png`: detalhe do rosto e dos ombros.
- `lia-shoulders.png`: conferência da ligação com os braços elevados a 120°.
  Regenerada com `blender --background --python scripts/blender/render_lia_checks.py`.
- `validation.json`: resultados dos testes reproduzíveis de integração.

Na biblioteca, abra **Personagens → Lia → Prévia**. Os seletores habituais trocam
as roupas. **Comparar voxel** alterna somente a prévia, sem salvar preferências.
A história **Lia — teste de movimentos Blender** reutiliza o teste de esqueleto
existente: caminhar, correr, gesticular, pular, sentar, deitar e exercícios.
As outras histórias que usam `lia` recebem o modelo automaticamente.

## Editar no Blender

O arquivo abre na câmera de apresentação. Em cada coleção `Wardrobe • …`, há uma
roupa. Deixe apenas uma visível por vez (viewport e render). `Lia_Rig` tem os ossos
de deformação com nomes iguais aos do Story Studio. Para inspecioná-los, ative
**Overlays**, selecione o rig e entre em **Pose Mode**. Os ossos têm os comprimentos
anatômicos correspondentes aos braços, pernas, tronco, pescoço e mãos.

O modelo é original, construído por superfícies e volumes em Python no Blender.
Os materiais são PBR, com cores de vértice no rosto. Não há imagens externas nem
assets de terceiros. A cor de cabelo, pele e detalhes é autoral e está no arquivo.

Para reconstruir todos os arquivos (isso substitui a fonte gerada, portanto salve
esculturas manuais com outro nome primeiro):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build_lia.py
```

Para gerar uma versão de estudo sem substituir os arquivos distribuídos, defina
`LIA_OUTPUT_DIR` com um diretório de saída absoluto antes do mesmo comando.

O script usa +X para frente, +Y para cima e ±Z para os lados, convertidos para os
eixos do Blender. O GLB usa +Y para cima. A importação aplica a transformação de
repouso à geometria e associa os pesos exportados a ossos com a convenção YXZ do
Story Studio. Assim, os documentos de ação e os pontos das mãos continuam iguais.
Cada instância clona o próprio esqueleto; a geometria fica compartilhada em cache.

## Limites deste protótipo

- Todas as 12 opções da Lia têm uma roupa modelada. O maiô é uma peça única.
- Altura e cor principal da roupa funcionam no navegador. Cabelo, formato do rosto,
  proporções e novos cortes precisam ser editados no Blender e reexportados.
- Pintura por células, ajustes de folga e escultura por regiões usam a versão
  voxel automaticamente, pois se referem à geometria procedural anterior.
- As saias usam pesos nos quadris/coxa, sem simulação de tecido. Poses extremas
  podem apresentar interseções entre roupa e pernas. A trança acompanha a cabeça,
  sem física de cabelo. O rosto ainda não tem rig de expressões ou sincronização labial.
- O arquivo `.blend` contém o rig; as animações são aplicadas pelo Story Studio em
  tempo real, não são clipes pré-gravados no GLB.
- O botão geral de importar GLB continua sendo para objetos. Este personagem é
  integrado pelo campo de documento `"model": "lia-v1"` e pelo catálogo
  `js/cast/models.js`. Outros personagens exigem modelagem e registro próprios.
- O GLB de origem inclui todas as roupas sobrepostas para transporte. Ao abri-lo
  em outro visualizador, esconda as roupas que não deseja. O Story Studio seleciona
  só uma; **Exportar GLB** exporta a roupa padrão do documento e seus ossos.
- Backups preservam os documentos inteiros e o id do modelo. Os assets distribuídos
  acompanham o site; não são duplicados no IndexedDB.

## Verificação

```sh
npm install --prefix /tmp/story-studio-lia-qa three@0.164.1 gltf-validator
node scripts/tests/story_studio_lia.mjs
```

O teste carrega os arquivos reais, valida o GLB, percorre as 12 roupas e as 10
poses e mais 5 posições com braços elevados (até 170°), exige conectividade real
entre peito/braços e camiseta/mangas, verifica pesos, instâncias independentes, deformação da malha, coordenadas
das mãos e o ciclo JSON usado por exportação/backup. O validador pode emitir avisos
`NODE_SKINNED_MESH_NON_ROOT` sobre a hierarquia exportada pelo Blender; a importação
normaliza essa hierarquia explicitamente.

Referências técnicas: [glTF no Blender](https://docs.blender.org/manual/en/4.0/addons/import_export/scene_gltf2.html)
e [clonagem de esqueletos no Three.js](https://threejs.org/docs/pages/module-SkeletonUtils.html).
