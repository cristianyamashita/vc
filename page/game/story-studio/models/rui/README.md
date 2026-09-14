# Rui — personagem Blender

Homem adulto de 1,86 m, ombros largos, mandíbula mais marcada e cabelo castanho curto. A roupa padrão é o macacão de trabalho com camiseta clara e botas.

O personagem utiliza a construção de superfícies conectadas da Lia, com um perfil
próprio de proporções em `scripts/blender/build_male.py`. O esqueleto tem 16 ossos
com articulações iguais às do personagem voxel. Os braços e o tronco compartilham
uma superfície; camisetas e mangas também são unidas antes do skinning.
As clavículas preenchem a transição até o pescoço. A checagem da fonte exige
superfícies fechadas sem túneis, além de conectividade e pesos válidos.

## Uso

Recarregue o Story Studio e abra **Personagens → Rui → Prévia**. As 9
roupas, suas cores principais, as poses e as ações usam os controles existentes.
**Comparar voxel** alterna a apresentação e **Arquivo Blender** baixa a fonte.
A história **Rui — teste de movimentos Blender** exercita as ações existentes.

No Blender, mantenha apenas uma malha `Wardrobe • …` visível por vez. O arquivo
abre na roupa padrão. `Rui_Rig` contém os ossos para edição em Pose Mode.

## Arquivos

- `rui.blend`: fonte editável com câmera, iluminação e 9 roupas.
- `rui.glb`: modelo para o navegador com as roupas e pesos de deformação.
- `rig.json`: articulações e correspondência entre ids de roupa e tipos de corte.
- `rui-preview.png`, `rui-detail.png`, `rui-shoulders.png`: revisão visual.
- `validation.json`: verificação das roupas, poses, ombros e exportação.
- `source-validation.json`: superfícies do corpo fechadas, sem túneis nos ombros.
- `../rui-tom-preview.png`: comparação das alturas reais de Rui e Tom.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build_rui.py -- --no-render
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/render_character_checks.py -- rui
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/validate_character_source.py -- rui
node scripts/tests/story_studio_lia.mjs rui
```

Defina `RUI_OUTPUT_DIR` para gerar estudos em outra pasta. A reconstrução
na pasta padrão substitui o arquivo gerado; salve esculturas manuais com outro nome.

## Roupas e limites

Os cortes são determinados pelo campo `outfit`, independentemente do nome local
da roupa. Calções de banho e toalhas na cintura seguem as versões masculinas;
macacões possuem peitoral e alças sobre camiseta, e botas são incluídas nos cortes
de trabalho e militar. Cores de pele e cabelo seguem o documento original.

O GLB de origem transporta todas as roupas. O Story Studio mostra só a selecionada;
a exportação pelo aplicativo inclui a roupa padrão e seu esqueleto.

O acabamento é estilizado, com materiais PBR, íris, pálpebras e orelhas modeladas.
Não há simulação de tecido/cabelo nem rig facial. Peças largas podem cruzar o corpo
em poses extremas. Pintura por células, folga e escultura por regiões continuam
usando a versão voxel. Os backups preservam o id `rui-v1`; os assets acompanham
o site e não são duplicados no armazenamento do navegador.
