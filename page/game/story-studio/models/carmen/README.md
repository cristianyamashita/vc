# Carmen — personagem Blender

Carmen tem 1,67 m, proporções adultas, pele morena, busto volumoso integrado ao
tronco e cabelo castanho muito escuro, longo e ondulado. O acabamento segue o
protótipo estilizado da Lia: olhos com íris e pálpebras, rosto esculpido, orelhas
com concha e materiais PBR. A malha e as mangas preservam a ligação contínua dos
ombros, com pesos distribuídos entre peito e braços.

Na biblioteca, abra **Personagens → Carmen → Prévia**. As 14 opções de roupa,
a cor principal, os controles de poses, as ações e as histórias continuam usando
os mesmos documentos. **Comparar voxel** permite alternar a prévia. O link
**Arquivo Blender** aponta para a fonte da personagem selecionada.

## Arquivos e reconstrução

- `carmen.blend`: fonte editável com 16 ossos, 14 roupas, câmera e luzes.
- `carmen.glb`: modelo distribuído com todas as roupas e pesos de deformação.
- `rig.json`: articulações e correspondência das roupas.
- `carmen-preview.png`, `carmen-detail.png`, `carmen-shoulders.png`: revisão visual.
- `validation.json`: resultados da integração e das deformações.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build_carmen.py -- --no-render
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/render_carmen_checks.py
node scripts/tests/story_studio_lia.mjs carmen
```

O gerador reaproveita a construção conectada de `build_lia.py`, aplica um perfil
adulto de proporções e modela um penteado próprio. As articulações correspondem
exatamente ao plano `woman` da Carmen voxel, preservando os pontos dos objetos
nas mãos. O perfil ajusta também as roupas à superfície final do busto.

Use `CARMEN_OUTPUT_DIR` para gerar estudos em outra pasta. Reconstruir na pasta
padrão substitui a fonte gerada; salve esculturas manuais com outro nome antes.
No Blender, ative só uma malha de coleção `Wardrobe • …` por vez. O GLB contém
as roupas sobrepostas para transporte; o Story Studio exibe só a escolhida.
A exportação pelo aplicativo inclui a roupa padrão e o esqueleto.

## Escopo

As 14 roupas são casual, camisola, roupa íntima opaca, maiô, camiseta e bermuda,
terno, vestido, camisa, jardineira, pijama, toalha, vestido tomara que caia,
shorts com top e uniforme militar. O modelo é original e procedural, sem assets
externos. Não utiliza física de tecido/cabelo nem rig facial. O cabelo acompanha
a cabeça; saias e peças largas podem cruzar o corpo em poses extremas.

Altura e cor principal são ajustáveis no navegador. Escultura, novas proporções,
cortes e penteados exigem edição no Blender. Pintura por células, folga e regiões
continuam recorrendo ao modelo voxel, como na Lia. O campo `model: carmen-v1`
permanece nos documentos exportados e nos backups; os assets acompanham o site.

A história **Carmen — teste de movimentos Blender** exercita a sequência de
movimentos já utilizada para Lia. A verificação automatizada percorre as 14
roupas, 10 poses, 5 elevações dos braços até 170°, ações, deformações, conectividade
dos ombros, pesos, instâncias independentes, exportação GLB e persistência JSON.
