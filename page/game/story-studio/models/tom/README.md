# Tom — personagem Blender

Garoto de 1,22 m, com cabeça proporcionalmente maior, rosto suave e cabelo loiro curto. A roupa padrão é camiseta laranja com bermuda azul e tênis.

O personagem utiliza a construção de superfícies conectadas da Lia, com um perfil
próprio de proporções em `scripts/blender/build_male.py`. O esqueleto tem 16 ossos
com articulações iguais às do personagem voxel. Os braços e o tronco compartilham
uma superfície; camisetas e mangas também são unidas antes do skinning.
As clavículas preenchem a transição até o pescoço. A checagem da fonte exige
superfícies fechadas sem túneis, além de conectividade e pesos válidos.

## Uso

Recarregue o Story Studio e abra **Personagens → Tom → Prévia**. As 8
roupas, suas cores principais, as poses e as ações usam os controles existentes.
**Comparar voxel** alterna a apresentação e **Arquivo Blender** baixa a fonte.
A história **Tom — teste de movimentos Blender** exercita as ações existentes.

No Blender, mantenha apenas uma malha `Wardrobe • …` visível por vez. O arquivo
abre na roupa padrão. `Tom_Rig` contém os ossos para edição em Pose Mode.

## Arquivos

- `tom.blend`: fonte editável com câmera, iluminação e 8 roupas.
- `tom.glb`: modelo para o navegador com as roupas e pesos de deformação.
- `rig.json`: articulações e correspondência entre ids de roupa e tipos de corte.
- `tom-preview.png`, `tom-detail.png`, `tom-shoulders.png`: revisão visual.
- `validation.json`: verificação das roupas, poses, ombros e exportação.
- `source-validation.json`: superfícies do corpo fechadas, sem túneis nos ombros.
- `../rui-tom-preview.png`: comparação das alturas reais de Rui e Tom.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build_tom.py -- --no-render
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/render_character_checks.py -- tom
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/validate_character_source.py -- tom
node scripts/tests/story_studio_lia.mjs tom
```

Defina `TOM_OUTPUT_DIR` para gerar estudos em outra pasta. A reconstrução
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
usando a versão voxel. Os backups preservam o id `tom-v1`; os assets acompanham
o site e não são duplicados no armazenamento do navegador.
