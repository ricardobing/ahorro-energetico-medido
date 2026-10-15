"""Portada y GIF del README a partir de las capturas de `npm run capturas`.

Uso: python scripts/componer-readme.py   (requiere Python 3 y Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

IMG = Path(__file__).resolve().parent.parent / "docs" / "img"
FONDO = (244, 243, 238)  # fondo cálido de la app
BORDE = (209, 219, 219)
OSCURO = (31, 54, 54)
LIMA = (212, 230, 61)


def fuente(tamano: int, negrita: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidatas = (
        ["C:/Windows/Fonts/segoeuib.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if negrita
        else ["C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for ruta in candidatas:
        if Path(ruta).exists():
            return ImageFont.truetype(ruta, tamano)
    return ImageFont.load_default()


def redondeada(img: Image.Image, radio: int) -> Image.Image:
    mascara = Image.new("L", img.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radio, fill=255)
    salida = Image.new("RGBA", img.size)
    salida.paste(img, (0, 0), mascara)
    return salida


def telefono(nombre: str, ancho: int) -> Image.Image:
    img = Image.open(IMG / f"{nombre}.png").convert("RGB")
    alto = round(img.height * ancho / img.width)
    img = img.resize((ancho, alto), Image.LANCZOS)
    marco = Image.new("RGBA", (ancho + 4, alto + 4), (0, 0, 0, 0))
    ImageDraw.Draw(marco).rounded_rectangle((0, 0, ancho + 3, alto + 3), 30, fill=BORDE)
    marco.alpha_composite(redondeada(img, 28), (2, 2))
    return marco


def portada() -> None:
    pantallas = [
        ("celular-primer-paso", "1. Qué hacer primero"),
        ("celular-ahorro-medido", "2. Cuánto ahorró, medido"),
        ("celular-como-lo-medimos", "3. Cómo se midió"),
    ]
    ancho, separacion, margen, alto_titulo = 520, 56, 64, 70
    telefonos = [telefono(n, ancho) for n, _ in pantallas]
    alto = margen * 2 + alto_titulo + telefonos[0].height
    lienzo = Image.new("RGBA", (margen * 2 + len(telefonos) * (ancho + 4) + (len(telefonos) - 1) * separacion, alto), FONDO)
    dibujo = ImageDraw.Draw(lienzo)
    letra = fuente(30)
    for i, (tel, (_, titulo)) in enumerate(zip(telefonos, pantallas)):
        x = margen + i * (ancho + 4 + separacion)
        dibujo.text((x + 4, margen), titulo, font=letra, fill=OSCURO)
        lienzo.alpha_composite(tel, (x, margen + alto_titulo))
    lienzo.convert("RGB").save(IMG / "portada.png", optimize=True)
    print("  - portada.png")


def recorrido() -> None:
    pasos = [
        ("celular-primer-paso", "Le recomienda un primer paso que puede terminar"),
        ("celular-plan-terminado", "Al terminar, le dice qué factura no cuenta"),
        ("celular-ahorro-todavia-no", "Con una factura: «todavía no podemos saberlo»"),
        ("celular-ahorro-medido", "Con dos: 6 % menos por día, unos S/ 90 al mes"),
        ("celular-como-lo-medimos", "Y muestra cómo lo midió, factura por factura"),
    ]
    ancho, alto_barra, margen = 390, 76, 22
    letra = fuente(16)
    cuadros = []
    for nombre, texto in pasos:
        img = Image.open(IMG / f"{nombre}.png").convert("RGB")
        img = img.resize((ancho, round(img.height * ancho / img.width)), Image.LANCZOS)
        cuadro = Image.new("RGB", (ancho, img.height + alto_barra), OSCURO)
        dibujo = ImageDraw.Draw(cuadro)
        dibujo.rectangle((0, alto_barra - 4, ancho, alto_barra), fill=LIMA)
        # Una o dos líneas, siempre con margen a los costados.
        lineas, actual = [], ""
        for palabra in texto.split():
            prueba = f"{actual} {palabra}".strip()
            if dibujo.textlength(prueba, font=letra) <= ancho - 2 * margen:
                actual = prueba
            else:
                lineas.append(actual)
                actual = palabra
        lineas.append(actual)
        alto_linea = 22
        y = (alto_barra - 4 - alto_linea * len(lineas)) / 2
        for linea in lineas:
            x = (ancho - dibujo.textlength(linea, font=letra)) / 2
            dibujo.text((x, y), linea, font=letra, fill=(255, 255, 255))
            y += alto_linea
        cuadro.paste(img, (0, alto_barra))
        cuadros.append(cuadro.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    cuadros[0].save(
        IMG / "recorrido.gif",
        save_all=True,
        append_images=cuadros[1:],
        duration=[2600, 2600, 2600, 3200, 3200],
        loop=0,
        optimize=True,
    )
    print("  - recorrido.gif")


if __name__ == "__main__":
    portada()
    recorrido()
