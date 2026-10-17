#!/usr/bin/env python3
"""Build the House Planner object catalog.

Copies curated box props from the story-studio library (and the Environment
Planner objects as a fallback), generates the vehicle props, assigns a
category and language-independent tags to each, and writes
page/assets/house-planner/manifest.json plus props/<id>.json.

Usage: python3 scripts/build_house_planner_catalog.py
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "page" / "assets" / "house-planner"
SS = Path("/Users/cristian/Projects/C/story-studio/data/props")
EP = ROOT / "page" / "assets" / "environment-planner" / "objects"

CATEGORIES = {
    "living": {"en": "Living room", "pt": "Sala", "ja": "リビング"},
    "bedroom": {"en": "Bedroom", "pt": "Quarto", "ja": "寝室"},
    "dining": {"en": "Dining", "pt": "Jantar", "ja": "ダイニング"},
    "kitchen": {"en": "Kitchen", "pt": "Cozinha", "ja": "キッチン"},
    "bathroom": {"en": "Bathroom", "pt": "Banheiro", "ja": "浴室"},
    "office": {"en": "Office", "pt": "Escritório", "ja": "オフィス"},
    "kids": {"en": "Kids", "pt": "Infantil", "ja": "子ども"},
    "lighting": {"en": "Lighting", "pt": "Iluminação", "ja": "照明"},
    "decor": {"en": "Decor", "pt": "Decoração", "ja": "装飾"},
    "garden": {"en": "Garden", "pt": "Jardim", "ja": "庭"},
    "trees": {"en": "Trees & plants", "pt": "Árvores e plantas", "ja": "木と植物"},
    "vehicles": {"en": "Vehicles", "pt": "Veículos", "ja": "乗り物"},
    "street": {"en": "Street", "pt": "Rua", "ja": "街路"},
    "sports": {"en": "Sports & gym", "pt": "Esporte e academia", "ja": "スポーツ"},
    "storage": {"en": "Garage & storage", "pt": "Garagem e depósito", "ja": "ガレージ・収納"},
}

# Category synonyms, added as tags to every item of the category.
CATEGORY_TAGS = {
    "living": ("living room lounge", "sala estar", "リビング 居間"),
    "bedroom": ("bedroom sleep", "quarto dormir", "寝室"),
    "dining": ("dining eat", "jantar refeicao", "ダイニング 食事"),
    "kitchen": ("kitchen cook", "cozinha cozinhar", "キッチン 台所"),
    "bathroom": ("bathroom bath", "banheiro banho", "浴室 風呂 トイレ"),
    "office": ("office work study", "escritorio trabalho estudo", "オフィス 仕事 勉強"),
    "kids": ("kids child toy play", "crianca infantil brinquedo", "子供 おもちゃ 遊び"),
    "lighting": ("lighting lamp light", "iluminacao luminaria luz", "照明 ランプ 明かり"),
    "decor": ("decor decoration", "decoracao enfeite", "装飾 飾り"),
    "garden": ("garden yard outdoor", "jardim quintal externo", "庭 屋外"),
    "trees": ("tree plant green", "arvore planta verde", "木 植物 緑"),
    "vehicles": ("vehicle car", "veiculo carro", "乗り物 車"),
    "street": ("street road city", "rua estrada cidade", "街路 道路 街"),
    "sports": ("sport gym fitness", "esporte academia", "スポーツ ジム 運動"),
    "storage": ("garage storage tools", "garagem deposito ferramentas", "ガレージ 収納 道具"),
}

# id -> (category, extra tags en, pt, ja). Items live in story-studio unless
# generated below. Order inside a category is the catalog order.
ITEMS: list[tuple[str, str, str, str, str]] = [
    # living
    ("sofa", "living", "couch", "", ""), ("sofa-two-seat", "living", "couch loveseat", "", ""),
    ("sofa-three-seat", "living", "couch", "", ""), ("sofa-corner", "living", "couch sectional", "", ""),
    ("sofa-bed", "living", "couch", "", ""), ("armchair", "living", "chair", "cadeira", "椅子"),
    ("armchair-lounge", "living", "chair", "cadeira", "椅子"), ("ottoman", "living", "pouf footstool", "banqueta", ""),
    ("coffee-table", "living", "table", "mesa centro", "テーブル"), ("side-table", "living", "table", "mesa", "テーブル"),
    ("console-table", "living", "table", "mesa aparador", "テーブル"), ("tv", "living", "television", "televisao", "テレビ"),
    ("tv-bench", "living", "television stand", "rack televisao", "テレビ台"), ("crt-tv", "living", "television old", "televisao antiga", "テレビ"),
    ("bookshelf", "living", "shelf books", "estante livros", "本棚"), ("cube-shelf", "living", "shelf", "estante", "棚"),
    ("sideboard", "living", "cabinet", "armario", "収納"), ("glass-cabinet", "living", "cabinet", "armario", "収納"),
    ("rug", "living", "carpet", "tapete", "カーペット"), ("round-rug", "living", "carpet", "tapete", "カーペット"),
    ("floor-cushion", "living", "pillow", "almofada", "クッション"), ("game-console", "living", "videogame", "videogame", "ゲーム"),
    ("radio", "living", "", "", ""), ("laptop", "living", "computer notebook", "computador", "パソコン"),
    ("houseplant", "living", "plant pot", "planta vaso", "観葉植物"), ("fern", "living", "plant", "planta", "植物"),
    ("folding-screen", "living", "divider", "divisoria", ""), ("curtain", "living", "window", "janela", "窓"),
    ("book", "living", "", "", ""), ("old-books", "living", "", "", ""), ("magazines", "living", "", "", ""),
    # bedroom
    ("double-bed", "bedroom", "bed", "cama", "ベッド"), ("king-bed", "bedroom", "bed", "cama", "ベッド"),
    ("single-bed", "bedroom", "bed", "cama solteiro", "ベッド"), ("bunk-bed", "bedroom", "bed", "cama beliche", "ベッド"),
    ("child-bed", "bedroom", "bed kids", "cama crianca", "ベッド 子供"), ("baby-crib", "bedroom", "bed baby", "cama bebe", "ベッド 赤ちゃん"),
    ("iron-bed", "bedroom", "bed", "cama", "ベッド"), ("nightstand", "bedroom", "bedside table", "mesa cabeceira", "ナイトテーブル"),
    ("chest-of-drawers", "bedroom", "dresser drawers", "comoda gavetas", "引き出し"), ("wardrobe", "bedroom", "closet", "armario roupa", "クローゼット"),
    ("sliding-wardrobe", "bedroom", "closet", "armario roupa", "クローゼット"), ("mattress", "bedroom", "bed", "cama", "ベッド"),
    ("pillow", "bedroom", "", "", ""), ("pillow-large", "bedroom", "", "", ""), ("body-pillow", "bedroom", "", "", ""),
    ("blanket", "bedroom", "", "", ""), ("sheet", "bedroom", "", "", ""), ("table-lamp", "bedroom", "light", "luz luminaria", "ランプ 照明"),
    ("standing-mirror", "bedroom", "mirror", "espelho", "鏡"), ("hammock", "bedroom", "", "", ""),
    # dining
    ("dining-table", "dining", "table", "mesa", "テーブル"), ("dining-chair", "dining", "chair", "cadeira", "椅子"),
    ("chair", "dining", "", "", ""), ("table", "dining", "", "", ""), ("round-table", "dining", "table", "mesa", "テーブル"),
    ("kitchen-table", "dining", "table", "mesa", "テーブル"), ("kitchen-child-chair", "dining", "chair kids", "cadeira crianca", "椅子 子供"),
    ("restaurant-table", "dining", "table", "mesa", "テーブル"), ("refectory-table", "dining", "table bench", "mesa banco", "テーブル"),
    ("stool", "dining", "", "", ""), ("bar-stool", "dining", "stool", "banqueta", "スツール"),
    ("bar-shelf", "dining", "bar bottles drinks back", "bar bebidas garrafas", "バー 酒 棚"),
    ("bar-counter", "dining", "counter", "balcao", "カウンター"), ("plastic-chair", "dining", "chair", "cadeira", "椅子"),
    ("plastic-table", "dining", "table", "mesa", "テーブル"),
    # kitchen
    ("kitchen-fridge", "kitchen", "fridge refrigerator", "geladeira", "冷蔵庫"), ("kitchen-stove", "kitchen", "stove oven cooker", "fogao forno", "コンロ オーブン"),
    ("kitchen-sink", "kitchen", "sink tap", "pia torneira", "シンク"), ("kitchen-counter", "kitchen", "counter cabinet", "balcao armario", "カウンター"),
    ("kitchen-hood", "kitchen", "hood extractor", "coifa", "レンジフード"), ("kitchen-board", "kitchen", "board", "tabua", "まな板"),
    ("kitchen-step", "kitchen", "", "", ""), ("cooking-pot", "kitchen", "pot pan", "panela", "鍋"),
    ("bread-basket", "kitchen", "", "", ""), ("dinner-plate", "kitchen", "", "", ""), ("salad-bowl", "kitchen", "", "", ""),
    ("pasta-bowl", "kitchen", "", "", ""), ("mug", "kitchen", "cup", "xicara", "カップ"), ("water-glass", "kitchen", "", "", ""),
    ("glass-bottle", "kitchen", "", "", ""), ("gas-cylinder", "kitchen", "", "", ""), ("chest-freezer", "kitchen", "freezer", "freezer", "冷凍庫"),
    # bathroom
    ("toilet", "bathroom", "wc", "vaso sanitario privada", "便器"), ("bathtub", "bathroom", "tub", "banheira", "浴槽"),
    ("bath-vanity", "bathroom", "sink", "pia", "洗面台"), ("shower-stall", "bathroom", "shower", "chuveiro", "シャワー"),
    ("shower-glass", "bathroom", "shower", "box chuveiro", "シャワー"), ("towel-rail", "bathroom", "", "", ""),
    ("towel-stack", "bathroom", "", "", ""), ("bath-mat", "bathroom", "", "", ""), ("bath-stool", "bathroom", "", "", ""),
    ("jacuzzi", "bathroom", "hot tub spa", "hidromassagem", "ジャグジー"), ("hinoki-tub", "bathroom", "tub", "ofuro", "風呂"),
    ("barrel-tub", "bathroom", "tub", "ofuro", "風呂"), ("wash-trough", "bathroom", "sink", "pia", "洗面台"),
    ("hairdryer", "bathroom", "", "", ""), ("wall-mirror", "bathroom", "mirror", "espelho", "鏡"),
    # office
    ("desk", "office", "table", "mesa", "机"), ("study-desk", "office", "table", "mesa", "机"),
    ("office-chair", "office", "chair", "cadeira", "椅子"), ("filing-cabinet", "office", "cabinet drawers", "arquivo", "キャビネット"),
    ("whiteboard", "office", "board", "quadro", "ボード"), ("corkboard", "office", "board", "quadro", "ボード"),
    ("blackboard", "office", "board", "quadro lousa", "黒板"), ("meeting-table", "office", "table", "mesa", "テーブル"),
    ("water-cooler", "office", "", "", ""), ("office-safe", "office", "safe", "cofre", "金庫"),
    ("school-desk", "office", "desk", "carteira", "机"), ("teacher-desk", "office", "desk", "mesa", "机"),
    ("notebook", "office", "", "", ""), ("pencil", "office", "", "", ""), ("wall-clock", "office", "clock", "relogio", "時計"),
    # kids
    ("toy-blocks", "kids", "", "", ""), ("plush-bear", "kids", "teddy", "pelucia", "ぬいぐるみ"),
    ("plush-rabbit", "kids", "teddy", "pelucia", "ぬいぐるみ"), ("plush-dolphin", "kids", "teddy", "pelucia", "ぬいぐるみ"),
    ("swing-set", "kids", "playground", "parquinho", "遊具"), ("slide", "kids", "playground", "parquinho escorregador", "遊具 滑り台"),
    ("seesaw", "kids", "playground", "parquinho", "遊具"), ("sandpit", "kids", "playground sand", "parquinho areia", "遊具 砂場"),
    ("roundabout", "kids", "playground", "parquinho", "遊具"), ("spring-rider", "kids", "playground", "parquinho", "遊具"),
    ("monkey-bars", "kids", "playground", "parquinho", "遊具"), ("kite", "kids", "", "", ""), ("hula-hoop", "kids", "", "", ""),
    # lighting
    ("floor-lamp", "lighting", "", "", ""), ("paper-floor-lamp", "lighting", "", "", ""), ("pendant-lamp", "lighting", "ceiling", "teto", "天井"),
    ("hanging-bulb", "lighting", "ceiling", "teto", "天井"), ("string-lights", "lighting", "", "", ""),
    ("lantern", "lighting", "", "", ""), ("candles", "lighting", "", "", ""), ("lamp", "lighting", "post street", "poste rua", "街灯"),
    ("stone-lantern", "lighting", "japanese garden", "jardim japones", "庭"), ("tiki-torch", "lighting", "torch garden", "tocha jardim", "庭"),
    ("wall-torch", "lighting", "", "", ""),
    # decor
    ("picture", "decor", "painting frame art", "quadro pintura", "絵 額"), ("neon-sign", "decor", "sign", "letreiro", "看板"),
    ("disco-ball", "decor", "", "", ""), ("noren", "decor", "", "", ""), ("shoji-door", "decor", "door japanese", "porta", "ドア"),
    ("display-wall", "decor", "", "", ""), ("mannequin", "decor", "", "", ""), ("suitcase", "decor", "luggage", "mala", "スーツケース"),
    ("steamer-trunk", "decor", "chest", "bau", "トランク"), ("backpack", "decor", "", "", ""),
    # garden
    ("bench", "garden", "seat", "banco", "ベンチ"), ("lounger", "garden", "sunbed pool", "espreguicadeira piscina", "デッキチェア プール"),
    ("beach-umbrella", "garden", "parasol pool", "guarda-sol piscina", "パラソル"), ("pergola", "garden", "", "", ""),
    ("bbq-grill", "garden", "barbecue grill", "churrasqueira", "バーベキュー"), ("campfire", "garden", "fire", "fogueira", "焚き火"),
    ("fence", "garden", "", "", ""), ("bamboo-fence", "garden", "", "", ""), ("ranch-fence", "garden", "fence", "cerca", "柵"),
    ("wall", "garden", "low wall", "muro", "塀"), ("flower-bed", "garden", "flowers", "flores", "花"),
    ("planter", "garden", "pot", "vaso", "鉢"), ("pond", "garden", "water", "agua lago", "池 水"),
    ("pool", "garden", "swimming water", "piscina agua", "プール"), ("tree-swing", "garden", "swing", "balanco", "ブランコ"),
    ("clothesline", "garden", "laundry", "varal roupa", "洗濯"), ("wheelbarrow", "garden", "", "", ""),
    ("bucket", "garden", "", "", ""), ("water-tank", "garden", "", "", ""), ("satellite-dish", "garden", "antenna", "antena", "アンテナ"),
    ("rock", "garden", "stone", "pedra", "石"), ("log", "garden", "wood", "madeira tronco", "木"),
    ("stump", "garden", "wood", "madeira", "木"), ("sand-pile", "garden", "", "", ""), ("reeds", "garden", "", "", ""),
    ("hay-bale", "garden", "farm", "fazenda", "農場"), ("tent", "garden", "camping", "camping", "キャンプ"),
    ("trail-sign", "garden", "sign", "placa", "看板"), ("dirt-patch", "garden", "", "", ""),
    # trees
    ("tree", "trees", "", "", ""), ("oak-tree", "trees", "", "", ""), ("big-tree", "trees", "", "", ""),
    ("birch-tree", "trees", "", "", ""), ("cherry-tree", "trees", "sakura", "sakura", "さくら"), ("maple-tree", "trees", "", "", ""),
    ("palm-tree", "trees", "coconut", "coqueiro", "ヤシ"), ("pine", "trees", "", "", ""), ("cypress", "trees", "", "", ""),
    ("eucalyptus", "trees", "", "", ""), ("ipe-tree", "trees", "", "", ""), ("araucaria", "trees", "", "", ""),
    ("willow-tree", "trees", "", "", ""), ("dead-tree", "trees", "", "", ""), ("banana-plant", "trees", "", "", ""),
    ("bush", "trees", "shrub hedge", "arbusto cerca viva", "低木 生け垣"),
    # vehicles (story-studio)
    ("car", "vehicles", "sedan hatch auto", "sedan automovel", "自動車 セダン"), ("convertible", "vehicles", "cabrio", "conversivel", "オープンカー"),
    ("motorcycle", "vehicles", "bike moto", "moto motocicleta", "バイク オートバイ"), ("bicycle", "vehicles", "bike", "bicicleta", "自転車"),
    ("motorhome", "vehicles", "camper rv", "trailer", "キャンピングカー"), ("tractor", "vehicles", "farm", "fazenda", "農場"),
    ("jetski", "vehicles", "boat water", "barco agua", "水上"),
    # street
    ("street-sign", "street", "sign", "placa", "標識"), ("traffic-light", "street", "", "", ""), ("fire-hydrant", "street", "", "", ""),
    ("trash-bin", "street", "garbage", "lixo", "ゴミ"), ("bus-stop", "street", "", "", ""), ("cone", "street", "traffic", "transito", "交通"),
    ("barrier", "street", "", "", ""), ("sidewalk", "street", "pavement", "calcada", "歩道"), ("road", "street", "", "", ""),
    ("crossroad", "street", "", "", ""),
    # sports
    ("treadmill", "sports", "", "", ""), ("exercise-bike", "sports", "", "", ""), ("rowing-machine", "sports", "", "", ""),
    ("weight-bench", "sports", "", "", ""), ("weight-rack", "sports", "", "", ""), ("dumbbell", "sports", "", "", ""),
    ("barbell", "sports", "", "", ""), ("basketball-hoop", "sports", "basket", "basquete", "バスケ"), ("volley-net", "sports", "", "", ""),
    ("volleyball", "sports", "", "", ""), ("ball", "sports", "", "", ""), ("pool-table", "sports", "billiards snooker", "sinuca bilhar", "ビリヤード"),
    ("goal", "sports", "football soccer", "futebol gol", "サッカー ゴール"), ("gym-mirror", "sports", "mirror wall", "espelho parede", "鏡 壁"),
    # storage
    ("cardboard-boxes", "storage", "", "", ""), ("pallet", "storage", "", "", ""), ("steel-shelf", "storage", "shelf", "estante", "棚"),
    ("tool-chest", "storage", "", "", ""), ("tool-board", "storage", "", "", ""), ("tool-trolley", "storage", "", "", ""),
    ("workbench", "storage", "", "", ""), ("ladder", "storage", "", "", ""), ("tyre-stack", "storage", "tires", "pneus", "タイヤ"),
    ("steel-drum", "storage", "barrel", "tambor", "ドラム缶"), ("wooden-barrel", "storage", "", "", ""),
    ("bricks", "storage", "", "", ""), ("planks", "storage", "wood", "madeira", "木材"), ("scaffold", "storage", "", "", ""),
    ("mixer", "storage", "", "", ""), ("cement-sack", "storage", "", "", ""), ("flatpack-stack", "storage", "", "", ""),
    ("air-compressor", "storage", "", "", ""), ("engine-hoist", "storage", "", "", ""), ("car-lift", "storage", "", "", ""),
    ("fuel-pump", "storage", "gas station", "posto gasolina", "ガソリン"), ("pallet-rack", "storage", "", "", ""),
]

MAX_PARTS = 180

# ----------------------------------------------------------------- vehicles


def box(w, h, d, x, y, z, color, **kw):
    b = {"w": round(w, 3), "h": round(h, 3), "d": round(d, 3), "x": round(x, 3), "y": round(y, 3), "z": round(z, 3), "color": color}
    b.update(kw)
    return b


def wheel(x, z, r, width, parts, rim="#b9bfc7"):
    parts.append(box(r * 2, r * 2, width, x, r, z, "#1f2226", shape="cylinder", axis="z"))
    parts.append(box(r * 1.3, r * 1.3, width + 0.02, x, r, z, rim, shape="cylinder", axis="z"))
    parts.append(box(r * 0.4, r * 0.4, width + 0.06, x, r, z, "#6f767f", shape="cylinder", axis="z"))


def car(cfg):
    L, W = cfg["L"], cfg["W"]
    color, dark, glass = cfg["color"], cfg.get("dark", "#2a2d33"), "#9fc3d2"
    r = cfg.get("r", 0.34)
    gc = r * 0.55  # ground clearance to body underside
    bh = cfg["bh"]
    parts = []
    body_y = gc + bh / 2
    parts.append(box(L, bh, W, 0, body_y, 0, color, shape="rounded"))
    parts.append(box(L * 0.98, 0.1, W * 0.9, 0, gc + 0.02, 0, dark))
    top = gc + bh
    # cabin
    cl, cx, ch = cfg["cab_len"], cfg["cab_x"], cfg["cab_h"]
    parts.append(box(cl, ch, W * 0.84, cx, top + ch / 2, 0, color, shape="rounded"))
    parts.append(box(cl * 0.96, ch * 0.62, W * 0.9, cx, top + ch * 0.45, 0, glass, opacity=0.5))
    parts.append(box(cl * 1.04, ch * 0.5, W * 0.6, cx, top + ch * 0.42, 0, glass, opacity=0.5))
    # mirrors
    parts.append(box(0.12, 0.08, 0.16, cx + cl * 0.42, top + ch * 0.45, W * 0.5, dark))
    parts.append(box(0.12, 0.08, 0.16, cx + cl * 0.42, top + ch * 0.45, -W * 0.5, dark))
    # lights and bumpers
    for s in (1, -1):
        parts.append(box(0.08, 0.14, 0.3, L / 2 - 0.02, gc + bh * 0.6, s * (W / 2 - 0.3), "#fff4c2"))
        parts.append(box(0.06, 0.12, 0.26, -L / 2 + 0.02, gc + bh * 0.6, s * (W / 2 - 0.26), "#d6372b"))
    parts.append(box(0.14, 0.16, W * 0.96, L / 2 - 0.04, gc + 0.14, 0, dark))
    parts.append(box(0.14, 0.16, W * 0.96, -L / 2 + 0.04, gc + 0.14, 0, dark))
    parts.append(box(0.5, 0.02, 0.12, L / 2 - 0.3, gc + bh * 0.4, 0, "#cfd4da"))  # grille accent
    # wheels
    wb = cfg.get("wb", L * 0.6)
    for x in (wb / 2, -wb / 2):
        for z in (W / 2 - 0.1, -(W / 2 - 0.1)):
            wheel(x, z, r, 0.22, parts)
    for extra in cfg.get("extra", lambda top, gc: [])(top, gc):
        parts.append(extra)
    return parts


def pickup_bed(L, W, color, dark):
    def make(top, gc):
        x0 = -L / 2 + 0.05
        x1 = -0.55
        length = x1 - x0
        cx = (x0 + x1) / 2
        return [
            box(length, 0.06, W * 0.84, cx, top - 0.2, 0, dark),
            box(length, 0.45, 0.06, cx, top + 0.05, W * 0.42, color),
            box(length, 0.45, 0.06, cx, top + 0.05, -W * 0.42, color),
            box(0.06, 0.45, W * 0.84, x0 + 0.03, top + 0.05, 0, color),
        ]
    return make


def roof_rails(top_cab):
    def make(top, gc):
        y = top_cab + 0.05
        return [box(1.9, 0.05, 0.05, -0.3, y, 0.65, "#4a4f58"), box(1.9, 0.05, 0.05, -0.3, y, -0.65, "#4a4f58")]
    return make


def spoiler(L):
    def make(top, gc):
        return [box(0.4, 0.04, 1.5, -L / 2 + 0.25, top + 0.32, 0, "#1b1d21"), box(0.06, 0.3, 0.06, -L / 2 + 0.25, top + 0.16, 0.55, "#1b1d21"), box(0.06, 0.3, 0.06, -L / 2 + 0.25, top + 0.16, -0.55, "#1b1d21")]
    return make


def moto(cfg):
    color, dark, chrome = cfg["color"], "#1f2226", "#b9bfc7"
    rf, rr = cfg.get("rf", 0.31), cfg.get("rr", 0.31)
    xf, xr = cfg["xf"], cfg["xr"]
    parts = []
    for x, r in ((xf, rf), (xr, rr)):
        parts.append(box(r * 2, r * 2, 0.14, x, r, 0, dark, shape="cylinder", axis="z"))
        parts.append(box(r * 1.5, r * 1.5, 0.16, x, r, 0, chrome, shape="cylinder", axis="z"))
    seat_y = cfg.get("seat_y", 0.8)
    # engine + frame
    if cfg.get("engine", True):
        parts.append(box(0.46, 0.36, 0.34, (xf + xr) / 2 - 0.05, 0.48, 0, "#6f767f", shape="rounded"))
    parts.append(box(abs(xf - xr) * 0.7, 0.07, 0.07, (xf + xr) / 2, seat_y - 0.1, 0, "#4a4f58", shape="cylinder", axis="x"))
    # tank and seat
    parts.append(box(cfg.get("tank_len", 0.6), 0.3, 0.38, (xf + xr) / 2 + 0.2, seat_y + 0.06, 0, color, shape="rounded"))
    parts.append(box(cfg.get("seat_len", 0.62), 0.12, 0.32, xr + 0.25, seat_y, 0, "#22252a", shape="rounded"))
    # fenders
    parts.append(box(rf * 1.4, 0.05, 0.2, xf, rf * 2 + 0.04, 0, color))
    parts.append(box(rr * 1.4, 0.05, 0.24, xr, rr * 2 + 0.04, 0, color))
    # forks (tilted) and handlebar
    rake = cfg.get("rake", 0.45)
    fork_len = cfg.get("fork_len", 0.7)
    for z in (0.09, -0.09):
        parts.append(box(0.05, fork_len, 0.05, xf - math.sin(rake) * fork_len / 2 * -1 - 0.02, rf + math.cos(rake) * fork_len / 2, z, chrome, shape="cylinder", rz=-rake))
    hb_y = cfg.get("hb_y", seat_y + 0.28)
    hb_x = xf + math.sin(rake) * fork_len * 0.9 * -1 + 0.14
    parts.append(box(0.04, 0.04, cfg.get("hb_w", 0.7), hb_x, hb_y, 0, chrome, shape="cylinder", axis="z"))
    parts.append(box(0.16, 0.16, 0.1, hb_x + 0.1, hb_y - 0.04, 0, "#fff4c2", shape="cylinder", axis="x"))  # headlight
    # exhaust
    parts.append(box(0.9, 0.08, 0.08, xr + 0.1, 0.3, 0.2, chrome, shape="cylinder", axis="x"))
    for extra in cfg.get("extra", []):
        parts.append(extra)
    return parts


def vehicles():
    docs = {}

    def doc(pid, name, boxes, footprint, tags):
        docs[pid] = ({"kind": "prop", "version": 1, "id": pid, "name": name, "footprint": footprint, "source": {"type": "boxes", "boxes": boxes}}, tags)

    doc("sedan", {"en": "Sedan car", "pt": "Carro sedã", "ja": "セダン"},
        car({"L": 4.6, "W": 1.8, "bh": 0.56, "cab_len": 2.1, "cab_x": -0.25, "cab_h": 0.5, "color": "#2e5aa8"}), [4.6, 1.8], ("auto family", "automovel familia", "自動車 乗用車"))
    doc("hatchback", {"en": "Hatchback", "pt": "Carro hatch", "ja": "ハッチバック"},
        car({"L": 4.0, "W": 1.75, "bh": 0.55, "cab_len": 2.2, "cab_x": -0.5, "cab_h": 0.55, "color": "#e0b43a", "r": 0.32}), [4.0, 1.75], ("auto compact city", "automovel compacto", "自動車 小型車"))
    doc("suv", {"en": "SUV", "pt": "SUV", "ja": "SUV"},
        car({"L": 4.7, "W": 1.9, "bh": 0.72, "cab_len": 2.7, "cab_x": -0.35, "cab_h": 0.62, "color": "#3f4a3c", "r": 0.4, "extra": roof_rails(0.4 * 0.55 + 0.72 + 0.62)}), [4.7, 1.9], ("auto jeep offroad 4x4", "automovel utilitario 4x4", "自動車 四駆"))
    doc("pickup-truck", {"en": "Pickup truck", "pt": "Caminhonete pickup", "ja": "ピックアップトラック"},
        car({"L": 5.3, "W": 1.9, "bh": 0.7, "cab_len": 1.7, "cab_x": 0.3, "cab_h": 0.62, "color": "#b3362a", "r": 0.4, "wb": 3.3, "extra": pickup_bed(5.3, 1.9, "#b3362a", "#2a2d33")}), [5.3, 1.9], ("truck auto", "caminhonete picape", "トラック"))
    doc("van", {"en": "Van", "pt": "Van", "ja": "バン"},
        car({"L": 5.0, "W": 1.95, "bh": 0.6, "cab_len": 4.5, "cab_x": -0.1, "cab_h": 1.15, "color": "#e8e6df", "r": 0.36, "wb": 3.2}), [5.0, 1.95], ("minibus delivery auto", "utilitario furgao entrega", "ワゴン 配達"))
    doc("sports-car", {"en": "Sports car", "pt": "Carro esportivo", "ja": "スポーツカー"},
        car({"L": 4.4, "W": 1.9, "bh": 0.44, "cab_len": 1.7, "cab_x": -0.3, "cab_h": 0.4, "color": "#c9202a", "r": 0.34, "wb": 2.7, "extra": spoiler(4.4)}), [4.4, 1.9], ("auto fast racing", "automovel corrida", "自動車 レース"))
    doc("sport-bike", {"en": "Sport motorcycle", "pt": "Moto esportiva", "ja": "スポーツバイク"},
        moto({"color": "#d7262f", "xf": 0.72, "xr": -0.7, "seat_y": 0.78, "rake": 0.38, "hb_y": 0.95, "hb_w": 0.62, "tank_len": 0.62,
              "extra": [box(0.6, 0.42, 0.5, 0.45, 0.62, 0, "#d7262f", shape="rounded"), box(0.3, 0.2, 0.44, 0.78, 0.88, 0, "#9fc3d2", opacity=0.5, rz=-0.5)]}),
        [2.05, 0.75], ("motorbike bike moto", "motocicleta", "バイク オートバイ"))
    doc("scooter", {"en": "Scooter", "pt": "Scooter", "ja": "スクーター"},
        moto({"color": "#f2f0ea", "xf": 0.6, "xr": -0.58, "rf": 0.22, "rr": 0.22, "seat_y": 0.76, "rake": 0.32, "fork_len": 0.5, "hb_y": 0.98, "hb_w": 0.64, "engine": False, "tank_len": 0.3, "seat_len": 0.7,
              "extra": [box(0.6, 0.06, 0.4, 0.0, 0.3, 0, "#f2f0ea", shape="rounded"), box(0.16, 0.6, 0.5, 0.5, 0.65, 0, "#f2f0ea", shape="rounded"), box(0.5, 0.34, 0.42, -0.5, 0.5, 0, "#d9d6cd", shape="rounded")]}),
        [1.8, 0.7], ("motorbike moped vespa", "motoneta lambreta", "原付 バイク"))
    doc("chopper", {"en": "Chopper motorcycle", "pt": "Moto chopper", "ja": "チョッパー"},
        moto({"color": "#1b1d21", "xf": 1.0, "xr": -0.75, "rf": 0.3, "rr": 0.36, "seat_y": 0.66, "rake": 0.72, "fork_len": 1.05, "hb_y": 1.1, "hb_w": 0.8, "tank_len": 0.7, "seat_len": 0.5,
              "extra": [box(0.08, 0.5, 0.06, 0.45, 0.95, 0.25, "#b9bfc7", shape="cylinder"), box(0.08, 0.5, 0.06, 0.45, 0.95, -0.25, "#b9bfc7", shape="cylinder"), box(0.5, 0.3, 0.3, -0.85, 0.75, 0, "#1b1d21", shape="rounded")]}),
        [2.5, 0.8], ("motorbike harley cruiser", "motocicleta custom", "バイク クルーザー"))
    return docs


# ------------------------------------------------------------------ fixtures


def fixtures():
    """Generated lamps: desk, wall, ceiling, garden and post lights."""
    docs = {}
    GLASS = "#fff1cc"

    def doc(pid, name, boxes, footprint, light, tags, mount=None):
        d = {"kind": "prop", "version": 1, "id": pid, "name": name, "footprint": footprint, "light": light, "source": {"type": "boxes", "boxes": boxes}}
        if mount:
            d["mount"] = mount
        docs[pid] = (d, tags)

    doc("desk-lamp", {"en": "Desk lamp", "pt": "Luminária de mesa articulada", "ja": "デスクランプ"}, [
        box(0.16, 0.02, 0.16, 0, 0.01, 0, "#2b2e33", shape="cylinder"),
        box(0.03, 0.3, 0.03, 0.04, 0.16, 0, "#4a4f58", shape="cylinder", rz=-0.35),
        box(0.03, 0.24, 0.03, 0.17, 0.36, 0, "#4a4f58", shape="cylinder", rz=0.9),
        box(0.14, 0.1, 0.14, 0.26, 0.4, 0, "#2b2e33", shape="cone", rz=1.2),
        box(0.08, 0.02, 0.08, 0.3, 0.37, 0, GLASS, shape="cylinder", rz=1.2),
    ], [0.4, 0.2], {"color": "#fff1cc", "intensity": 1.2, "distance": 2.5, "at": [0.3, 0.33, 0]}, ("desk table lamp", "mesa escritorio", "机 ランプ"))
    doc("wall-sconce", {"en": "Wall sconce", "pt": "Arandela", "ja": "ウォールランプ"}, [
        box(0.12, 0.2, 0.02, 0, 0, 0.01, "#4a4f58", shape="rounded"),
        box(0.02, 0.02, 0.1, 0, 0.02, 0.06, "#4a4f58", shape="cylinder", axis="z"),
        box(0.18, 0.12, 0.18, 0, 0.06, 0.13, "#f0e6d2", shape="cone", opacity=0.9),
        box(0.06, 0.06, 0.06, 0, 0.04, 0.13, GLASS, shape="sphere"),
    ], [0.2, 0.25], {"color": "#ffd9a8", "intensity": 1.3, "distance": 3.5, "at": [0, 0.08, 0.14]}, ("wall light sconce", "parede luz arandela", "壁 ブラケット"), "wall")
    doc("wall-lantern", {"en": "Outdoor wall lantern", "pt": "Luminária externa de parede", "ja": "屋外ウォールランタン"}, [
        box(0.1, 0.16, 0.02, 0, 0, 0.01, "#2b2e33"),
        box(0.02, 0.02, 0.14, 0, 0.06, 0.08, "#2b2e33", shape="cylinder", axis="z"),
        box(0.14, 0.2, 0.14, 0, -0.06, 0.16, GLASS, opacity=0.5),
        box(0.16, 0.02, 0.16, 0, 0.05, 0.16, "#2b2e33"),
        box(0.16, 0.02, 0.16, 0, -0.17, 0.16, "#2b2e33"),
        box(0.02, 0.2, 0.02, 0.07, -0.06, 0.09, "#2b2e33"), box(0.02, 0.2, 0.02, -0.07, -0.06, 0.09, "#2b2e33"),
        box(0.02, 0.2, 0.02, 0.07, -0.06, 0.23, "#2b2e33"), box(0.02, 0.2, 0.02, -0.07, -0.06, 0.23, "#2b2e33"),
    ], [0.2, 0.3], {"color": "#ffcf8a", "intensity": 1.6, "distance": 5, "at": [0, -0.06, 0.16]}, ("outdoor wall lantern garden", "externa jardim lanterna", "屋外 ランタン"), "wall")
    doc("ceiling-flush", {"en": "Ceiling light", "pt": "Plafon de teto", "ja": "シーリングライト"}, [
        box(0.36, 0.04, 0.36, 0, -0.02, 0, "#e8e2d6", shape="cylinder"),
        box(0.3, 0.08, 0.3, 0, -0.07, 0, GLASS, shape="cylinder", opacity=0.85),
    ], [0.36, 0.36], {"color": "#fff4dd", "intensity": 2.4, "distance": 6, "at": [0, -0.12, 0]}, ("ceiling flush light", "teto plafon", "天井 照明"), "ceiling")
    chand = [box(0.03, 0.4, 0.03, 0, -0.2, 0, "#c9a24a", shape="cylinder"), box(0.7, 0.03, 0.7, 0, -0.42, 0, "#c9a24a", shape="torus", tube=0.1)]
    import math as _m
    for k in range(6):
        a = k * _m.pi / 3
        chand.append(box(0.05, 0.12, 0.05, 0.3 * _m.cos(a), -0.36, 0.3 * _m.sin(a), "#c9a24a", shape="cylinder"))
        chand.append(box(0.06, 0.06, 0.06, 0.3 * _m.cos(a), -0.27, 0.3 * _m.sin(a), GLASS, shape="sphere"))
    doc("chandelier", {"en": "Chandelier", "pt": "Lustre", "ja": "シャンデリア"}, chand, [0.7, 0.7], {"color": "#ffe3b0", "intensity": 2.6, "distance": 7, "at": [0, -0.3, 0]}, ("ceiling chandelier", "teto lustre", "天井 シャンデリア"), "ceiling")
    rail = [box(1.0, 0.03, 0.03, 0, -0.015, 0, "#2b2e33")]
    for x in (-0.35, 0, 0.35):
        rail.append(box(0.03, 0.08, 0.03, x, -0.07, 0, "#2b2e33", shape="cylinder"))
        rail.append(box(0.08, 0.12, 0.08, x, -0.15, 0.03, "#2b2e33", shape="cylinder", rx=0.5))
        rail.append(box(0.06, 0.01, 0.06, x, -0.2, 0.06, GLASS, shape="cylinder", rx=0.5))
    doc("spot-rail", {"en": "Spotlight rail", "pt": "Trilho de spots", "ja": "スポットライトレール"}, rail, [1.0, 0.2], {"color": "#fff4dd", "intensity": 2.2, "distance": 5, "at": [0, -0.2, 0.05]}, ("ceiling spots track", "teto spots trilho", "天井 スポット"), "ceiling")
    doc("garden-bollard", {"en": "Garden bollard light", "pt": "Balizador de jardim", "ja": "ガーデンライト（ポール）"}, [
        box(0.1, 0.6, 0.1, 0, 0.3, 0, "#3b4044", shape="cylinder"),
        box(0.12, 0.08, 0.12, 0, 0.62, 0, GLASS, shape="cylinder", opacity=0.8),
        box(0.14, 0.02, 0.14, 0, 0.67, 0, "#3b4044", shape="cylinder"),
    ], [0.14, 0.14], {"color": "#ffd9a8", "intensity": 1.2, "distance": 4, "at": [0, 0.62, 0]}, ("garden path light bollard", "jardim caminho balizador", "庭 小道 照明"))
    doc("garden-spike", {"en": "Garden spike light", "pt": "Espeto de luz para jardim", "ja": "ガーデンスパイクライト"}, [
        box(0.02, 0.15, 0.02, 0, 0.0, 0, "#3b4044", shape="cylinder"),
        box(0.08, 0.14, 0.08, 0, 0.14, 0.03, "#3b4044", shape="cylinder", rx=-0.7),
        box(0.06, 0.01, 0.06, 0, 0.19, 0.08, GLASS, shape="cylinder", rx=-0.7),
    ], [0.1, 0.16], {"color": "#fff1cc", "intensity": 1.4, "distance": 4, "at": [0, 0.2, 0.1]}, ("garden spot uplight", "jardim spot", "庭 スポット"))
    doc("post-cap-light", {"en": "Post cap light", "pt": "Luminária de pilar de muro", "ja": "門柱灯"}, [
        box(0.18, 0.02, 0.18, 0, 0.01, 0, "#3b4044"),
        box(0.14, 0.14, 0.14, 0, 0.09, 0, GLASS, opacity=0.6),
        box(0.02, 0.14, 0.02, 0.07, 0.09, 0.07, "#3b4044"), box(0.02, 0.14, 0.02, -0.07, 0.09, 0.07, "#3b4044"),
        box(0.02, 0.14, 0.02, 0.07, 0.09, -0.07, "#3b4044"), box(0.02, 0.14, 0.02, -0.07, 0.09, -0.07, "#3b4044"),
        box(0.2, 0.02, 0.2, 0, 0.17, 0, "#3b4044", shape="cone"),
    ], [0.2, 0.2], {"color": "#ffcf8a", "intensity": 1.5, "distance": 5, "at": [0, 0.09, 0]}, ("wall post cap light fence gate", "muro pilar cerca portao", "塀 柱 門"))
    return docs



# ------------------------------------------------------------------ leisure


def leisure():
    """Generated gym, bar, office and façade props (garage + leisure sample)."""
    docs = {}
    STEEL, DARK, WOOD, GLASS, CHROME = "#2b2e33", "#1c1e22", "#8a6a48", "#fff1cc", "#9aa0a8"

    def doc(pid, name, cat, boxes, footprint, tags, light=None, mount=None):
        d = {"kind": "prop", "version": 1, "id": pid, "name": name, "footprint": footprint, "source": {"type": "boxes", "boxes": boxes}}
        if light:
            d["light"] = light
        if mount:
            d["mount"] = mount
        docs[pid] = (d, tags, cat)

    # power rack with pull-up bar, J-hooks and a loaded barbell
    rack = [box(1.3, 0.02, 1.4, 0, 0.01, 0, "#3a3d42")]
    for x in (-0.55, 0.55):
        for z in (-0.6, 0.6):
            rack.append(box(0.06, 2.2, 0.06, x, 1.1, z, STEEL))
        rack.append(box(0.06, 0.06, 1.26, x, 2.17, 0, STEEL))
        rack.append(box(0.06, 0.06, 1.26, x, 0.05, 0, STEEL))
        rack.append(box(0.1, 0.05, 0.12, x, 1.0, -0.3, "#c9202a"))
    rack.append(box(1.16, 0.03, 0.03, 0, 2.17, 0.6, CHROME, shape="cylinder", axis="x"))
    rack.append(box(2.2, 0.03, 0.03, 0, 1.04, -0.3, CHROME, shape="cylinder", axis="x"))
    for x in (-0.9, 0.9):
        rack.append(box(0.04, 0.45, 0.45, x, 1.04, -0.3, DARK, shape="cylinder", axis="x"))
        rack.append(box(0.03, 0.35, 0.35, x + (0.05 if x > 0 else -0.05), 1.04, -0.3, "#c9202a", shape="cylinder", axis="x"))
    doc("squat-rack", {"en": "Power rack with barbell", "pt": "Gaiola de agachamento com barra", "ja": "パワーラック"}, "sports", rack, [2.3, 1.5],
        ("squat rack cage barbell weights", "agachamento gaiola barra pesos musculacao", "スクワット バーベル 筋トレ"))

    # three-tier dumbbell rack
    dr = [box(0.06, 0.95, 0.5, x, 0.48, 0, STEEL) for x in (-0.6, 0.6)]
    for i, (y, zc) in enumerate(((0.25, 0.12), (0.55, 0.0), (0.85, -0.12))):
        dr.append(box(1.2, 0.03, 0.3, 0, y, zc, STEEL))
        for k in range(5):
            x = -0.45 + k * 0.225
            r = 0.07 + i * 0.015
            dr.append(box(0.09, 0.03, 0.03, x, y + 0.03 + r, zc, CHROME, shape="cylinder", axis="x"))
            dr.append(box(0.05, r * 2, r * 2, x - 0.065, y + 0.03 + r, zc, DARK, shape="cylinder", axis="x"))
            dr.append(box(0.05, r * 2, r * 2, x + 0.065, y + 0.03 + r, zc, DARK, shape="cylinder", axis="x"))
    doc("dumbbell-rack", {"en": "Dumbbell rack", "pt": "Suporte de halteres", "ja": "ダンベルラック"}, "sports", dr, [1.25, 0.55],
        ("dumbbells rack weights", "halteres pesos suporte musculacao", "ダンベル 筋トレ"))

    # kettlebells on a rubber tray
    kb = [box(0.95, 0.03, 0.4, 0, 0.015, 0, "#3a3d42")]
    for k, sz in enumerate((0.2, 0.25, 0.3)):
        x = -0.32 + k * 0.32
        kb.append(box(sz, sz, sz, x, 0.03 + sz / 2, 0, DARK, shape="sphere"))
        kb.append(box(sz * 0.7, sz * 0.5, 0.04, x, 0.03 + sz + 0.02, 0, DARK, shape="torus", tube=0.2, rx=1.5708))
    doc("kettlebell-set", {"en": "Kettlebells", "pt": "Kettlebells", "ja": "ケトルベル"}, "sports", kb, [1.0, 0.45],
        ("kettlebell weights", "pesos musculacao", "筋トレ"))

    doc("yoga-mat", {"en": "Yoga mat", "pt": "Tapete de yoga", "ja": "ヨガマット"}, "sports", [
        box(0.61, 0.01, 1.8, 0, 0.005, 0, "#6f4bb0"),
        box(0.61, 0.09, 0.09, 0, 0.05, -0.86, "#6f4bb0", shape="cylinder", axis="x"),
    ], [0.65, 1.85], ("yoga mat stretch pilates", "yoga alongamento pilates", "ヨガ ストレッチ"))
    doc("exercise-ball", {"en": "Exercise ball", "pt": "Bola de pilates", "ja": "バランスボール"}, "sports", [
        box(0.65, 0.65, 0.65, 0, 0.325, 0, "#2f6fb3", shape="sphere"),
    ], [0.65, 0.65], ("ball swiss pilates gym", "bola suica pilates", "ボール ピラティス"))
    doc("foam-roller", {"en": "Foam roller", "pt": "Rolo de massagem", "ja": "フォームローラー"}, "sports", [
        box(0.15, 0.15, 0.9, 0, 0.075, 0, STEEL, shape="cylinder", axis="z"),
    ], [0.15, 0.9], ("foam roller massage", "rolo massagem", "ローラー"))

    # medicine balls on a two-post rack
    mb = [box(0.05, 1.0, 0.05, x, 0.5, 0, STEEL) for x in (-0.38, 0.38)]
    cols = ("#c9202a", "#2f6fb3", "#e0a526", "#2f9e6b", "#6f4bb0", "#f2ede4")
    for i, (y, sz) in enumerate(((0.22, 0.28), (0.55, 0.24), (0.85, 0.2))):
        for z in (-0.1, 0.1):
            mb.append(box(0.8, 0.025, 0.025, 0, y, z, STEEL, shape="cylinder", axis="x"))
        for j, x in enumerate((-0.18, 0.18)):
            mb.append(box(sz, sz, sz, x, y + sz / 2 + 0.01, 0, cols[i * 2 + j], shape="sphere"))
    doc("medicine-ball-rack", {"en": "Medicine ball rack", "pt": "Suporte de bolas medicinais", "ja": "メディシンボールラック"}, "sports", mb, [0.85, 0.35],
        ("medicine balls rack", "bolas medicinais suporte", "ボール ラック"))

    # lockers
    lk = [box(1.6, 1.8, 0.5, 0, 0.9, 0, "#3a3d42")]
    for x in (-0.6, -0.2, 0.2, 0.6):
        lk.append(box(0.36, 1.7, 0.02, x, 0.9, 0.26, "#4b5059"))
        lk.append(box(0.03, 0.1, 0.02, x + 0.14, 0.95, 0.28, CHROME))
        lk.append(box(0.2, 0.08, 0.01, x, 1.6, 0.275, DARK))
    doc("gym-lockers", {"en": "Lockers", "pt": "Armários de vestiário", "ja": "ロッカー"}, "sports", lk, [1.6, 0.5],
        ("lockers cabinet changing room", "armario vestiario", "ロッカー 更衣"))

    # wall cue rack (wall mount: back at z=0, y around the hanging point)
    cr = [box(0.6, 0.08, 0.03, 0, 0.75, 0.015, WOOD), box(0.6, 0.08, 0.07, 0, -0.75, 0.035, WOOD)]
    for x in (-0.22, -0.074, 0.074, 0.22):
        cr.append(box(0.025, 1.45, 0.025, x, 0, 0.045, "#c8a06a", shape="cylinder"))
        cr.append(box(0.015, 0.02, 0.015, x, 0.735, 0.045, "#3b6fa0", shape="cylinder"))
    doc("cue-rack", {"en": "Cue rack", "pt": "Suporte de tacos", "ja": "キューラック"}, "sports", cr, [0.6, 0.08],
        ("billiards pool cue rack wall", "sinuca bilhar taco parede", "ビリヤード キュー"), mount="wall")

    doc("coffee-machine", {"en": "Espresso machine", "pt": "Máquina de café", "ja": "エスプレッソマシン"}, "kitchen", [
        box(0.28, 0.38, 0.34, 0, 0.19, 0, DARK, shape="rounded"),
        box(0.28, 0.03, 0.34, 0, 0.395, 0, CHROME),
        box(0.07, 0.07, 0.08, 0, 0.19, 0.19, CHROME, shape="cylinder", axis="z"),
        box(0.02, 0.02, 0.12, 0, 0.16, 0.26, DARK, shape="cylinder", axis="z"),
        box(0.24, 0.02, 0.1, 0, 0.03, 0.2, CHROME),
        box(0.07, 0.06, 0.07, 0, 0.07, 0.2, "#f2ede4", shape="cylinder"),
    ], [0.3, 0.4], ("coffee espresso machine", "cafe cafeteira expresso", "コーヒー"))

    mf = [
        box(0.5, 0.85, 0.55, 0, 0.425, 0, DARK, shape="rounded"),
        box(0.46, 0.75, 0.01, 0, 0.45, 0.275, STEEL),
        box(0.42, 0.7, 0.02, 0, 0.45, 0.285, "#9fc3d2", opacity=0.45),
        box(0.02, 0.4, 0.03, 0.2, 0.45, 0.3, CHROME),
        box(0.4, 0.01, 0.45, 0, 0.35, 0, "#c8ced6"), box(0.4, 0.01, 0.45, 0, 0.6, 0, "#c8ced6"),
    ]
    for y in (0.46, 0.71):
        for k, x in enumerate((-0.12, 0, 0.12)):
            mf.append(box(0.06, 0.2, 0.06, x, y, 0.1, ("#2f9e6b", "#c9202a", "#e0a526")[k], shape="cylinder"))
    doc("mini-fridge", {"en": "Bar fridge", "pt": "Frigobar", "ja": "ミニ冷蔵庫"}, "kitchen", mf, [0.5, 0.55],
        ("mini fridge bar drinks beverage", "frigobar geladeira bebidas", "冷蔵庫 飲み物"))

    doc("wall-tv", {"en": "Wall-mounted TV", "pt": "TV de parede", "ja": "壁掛けテレビ"}, "living", [
        box(0.2, 0.2, 0.03, 0, 0, 0.015, "#3a3d42"),
        box(1.6, 0.9, 0.04, 0, 0, 0.05, DARK),
        box(1.52, 0.84, 0.005, 0, 0, 0.075, "#2a6fa0", flat=True),
    ], [1.6, 0.1], ("television screen wall", "televisao tela parede", "テレビ 壁"), mount="wall")

    ws = []
    bookc = ("#b3362a", "#2f6fb3", "#e0a526", "#2f9e6b", "#6f4bb0", "#f2ede4", "#8a6a48", "#3b6fa0", "#c9202a")
    for i, y in enumerate((-0.35, 0, 0.35)):
        ws.append(box(1.2, 0.03, 0.25, 0, y, 0.125, WOOD))
        for j, x in enumerate((-0.4, 0, 0.4)):
            if i == 2 and j == 2:
                continue
            ws.append(box(0.25, 0.22, 0.18, x, y + 0.125, 0.12, bookc[i * 3 + j]))
    ws.append(box(0.1, 0.1, 0.1, 0.45, 0.415, 0.12, "#b87333", shape="cylinder"))
    ws.append(box(0.2, 0.14, 0.2, 0.45, 0.54, 0.12, "#3f8f4a", shape="sphere"))
    doc("wall-shelves", {"en": "Wall shelves with books", "pt": "Prateleiras de parede com livros", "ja": "壁の棚と本"}, "office", ws, [1.2, 0.25],
        ("shelf books wall", "prateleira livros parede", "棚 本 壁"), mount="wall")

    sl = [box(2.4, 0.06, 0.05, 0, 2.57, 0, WOOD), box(2.4, 0.06, 0.05, 0, 0.03, 0, WOOD)]
    for k in range(12):
        sl.append(box(0.06, 2.6, 0.04, -1.1 + k * 0.2, 1.3, 0, "#8a6a48", grain=0.03))
    doc("slat-panel", {"en": "Wooden slat panel", "pt": "Painel ripado de madeira", "ja": "木製ルーバーパネル"}, "decor", sl, [2.4, 0.06],
        ("slats louvre brise facade screen wood", "ripado brise fachada madeira", "ルーバー 格子 木 外壁"))

    doc("led-strip", {"en": "LED strip", "pt": "Fita de LED", "ja": "LEDバー"}, "lighting", [
        box(2.0, 0.02, 0.04, 0, -0.01, 0, CHROME),
        box(1.98, 0.01, 0.03, 0, -0.025, 0, GLASS, opacity=0.9),
    ], [2.0, 0.05], ("led strip linear ceiling light", "led linear teto luz", "LED 天井 照明"),
        light={"color": "#fff4dd", "intensity": 1.6, "distance": 4.5, "at": [0, -0.05, 0]}, mount="ceiling")
    doc("downlight", {"en": "Recessed downlight", "pt": "Spot embutido", "ja": "ダウンライト"}, "lighting", [
        box(0.1, 0.01, 0.1, 0, -0.005, 0, "#e8e2d6", shape="cylinder"),
        box(0.07, 0.006, 0.07, 0, -0.012, 0, GLASS, shape="cylinder"),
    ], [0.1, 0.1], ("recessed spot downlight ceiling", "spot embutido teto", "ダウンライト 天井"),
        light={"color": "#fff4dd", "intensity": 1.4, "distance": 4, "at": [0, -0.04, 0]}, mount="ceiling")
    return docs


# ------------------------------------------------------------------ build


def fold(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def words(s: str) -> list[str]:
    return [w for w in re.split(r"[\s,/()·-]+", fold(s)) if len(w) > 1]


def tags_for(cat: str, name: dict, extra: tuple[str, str, str]) -> dict:
    cen, cpt, cja = CATEGORY_TAGS[cat]
    out = {
        "en": sorted(set(words(name.get("en", "")) + words(extra[0]) + words(cen))),
        "pt": sorted(set(words(name.get("pt", "")) + words(extra[1]) + words(cpt))),
        "ja": sorted(set([w for w in re.split(r"[\s（）()・]+", name.get("ja", "")) if w] + cja.split() + extra[2].split())),
    }
    return out


def load_source(pid: str):
    for base in (SS, EP):
        f = base / f"{pid}.json"
        if f.exists():
            try:
                d = json.loads(f.read_text())
            except json.JSONDecodeError:
                continue
            if d.get("source", {}).get("type") == "boxes":
                return d
    return None


def main() -> None:
    props_dir = OUT / "props"
    props_dir.mkdir(parents=True, exist_ok=True)
    for old in props_dir.glob("*.json"):
        old.unlink()
    manifest = {"kind": "housePlannerCatalog", "version": 1, "categories": CATEGORIES, "props": []}
    generated = vehicles()
    seen = set()
    skipped = []
    for pid, cat, ten, tpt, tja in ITEMS:
        if pid in seen:
            continue
        seen.add(pid)
        d = load_source(pid)
        if d is None:
            skipped.append(pid)
            continue
        boxes = [b for b in d["source"]["boxes"] if not b.get("hole")]
        if len(boxes) > MAX_PARTS:
            skipped.append(f"{pid} ({len(boxes)} parts)")
            continue
        name = d.get("name") if isinstance(d.get("name"), dict) else {"en": str(d.get("name", pid))}
        name = {"en": name.get("en", pid), "pt": name.get("pt") or name.get("en", pid), "ja": name.get("ja") or name.get("en", pid)}
        write(props_dir, manifest, pid, name, cat, tags_for(cat, name, (ten, tpt, tja)), boxes, d.get("footprint"), d.get("light"))
        if pid == "wall-torch":
            for gid, (gdoc, gtags) in fixtures().items():
                write(props_dir, manifest, gid, gdoc["name"], "lighting", tags_for("lighting", gdoc["name"], gtags), gdoc["source"]["boxes"], gdoc["footprint"], gdoc.get("light"), gdoc.get("mount"))
        if pid == "motorcycle":
            # generated vehicles follow the first motorcycle in the catalog order
            for gid, (gdoc, gtags) in generated.items():
                write(props_dir, manifest, gid, gdoc["name"], "vehicles", tags_for("vehicles", gdoc["name"], gtags), gdoc["source"]["boxes"], gdoc["footprint"])
    for gid, (gdoc, gtags, gcat) in leisure().items():
        write(props_dir, manifest, gid, gdoc["name"], gcat, tags_for(gcat, gdoc["name"], gtags), gdoc["source"]["boxes"], gdoc["footprint"], gdoc.get("light"), gdoc.get("mount"))
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    total = sum(p["parts"] for p in manifest["props"])
    print(f"{len(manifest['props'])} props, {total} parts total")
    if skipped:
        print("skipped:", ", ".join(skipped))


# Light descriptors (story-studio format, metres) for lamps that lack one,
# and mounts for fixtures that hang from the ceiling or sit on a wall.
LIGHTS = {
    "floor-lamp": {"color": "#ffd9a8", "intensity": 1.8, "distance": 4.5, "at": [0, 1.72, 0]},
    "paper-floor-lamp": {"color": "#ffe4bd", "intensity": 1.4, "distance": 4, "at": [0, 0.87, 0]},
    "table-lamp": {"color": "#ffd9a8", "intensity": 1.2, "distance": 3, "at": [0, 0.37, 0]},
    "hanging-bulb": {"color": "#fff1cc", "intensity": 1.8, "distance": 5, "at": [0, -0.14, 0]},
    "string-lights": {"color": "#fff2cc", "intensity": 1.2, "distance": 4, "at": [0, -0.3, 0]},
    "lamp": {"color": "#ffe9b0", "intensity": 3, "distance": 9, "at": [0, 3.24, 0]},
    "tiki-torch": {"color": "#ffb866", "intensity": 2, "distance": 5, "at": [0, 2.24, 0]},
    "wall-torch": {"color": "#ffb866", "intensity": 1.8, "distance": 4.5, "at": [0, 0.73, 0.31]},
}
MOUNTS = {"pendant-lamp": "ceiling", "hanging-bulb": "ceiling", "string-lights": "ceiling", "wall-torch": "wall", "wall-sconce": "wall", "wall-lantern": "wall", "ceiling-flush": "ceiling", "chandelier": "ceiling", "spot-rail": "ceiling"}


def write(props_dir, manifest, pid, name, cat, tags, boxes, footprint, light=None, mount=None):
    doc = {"kind": "prop", "version": 1, "id": pid, "name": name, "source": {"type": "boxes", "boxes": boxes}}
    if footprint:
        doc["footprint"] = footprint
    light = light or LIGHTS.get(pid)
    if light:
        doc["light"] = light
    mount = mount or MOUNTS.get(pid)
    if mount:
        doc["mount"] = mount
    (props_dir / f"{pid}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    manifest["props"].append({"id": pid, "name": name, "category": cat, "tags": tags, "file": f"props/{pid}.json", "parts": len(boxes)})


if __name__ == "__main__":
    main()
