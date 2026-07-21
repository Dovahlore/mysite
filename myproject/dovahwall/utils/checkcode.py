import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter


def check_code(width=150, height=50, char_length=4, font_file='collect_static/font/DINCOROS-Black-2.ttf', font_size=44):
    code = []
    img = Image.new(mode='RGB', size=(width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img, mode='RGB')

    def rndChar():
        """
        生成随机大小写字母
        :return:
        """
        up_or_low = random.randint(0, 1)
        if up_or_low == 0:
            return chr(random.randint(97, 122))
        return chr(random.randint(65, 90))

    def rndColor():
        """
        生成随机颜色
        :return:
        """
        return (random.randint(0, 255), random.randint(10, 255), random.randint(64, 255))

    # 写文字
    font = ImageFont.truetype(font_file, font_size)
    for i in range(char_length):
        char = rndChar()
        code.append(char)
        h = random.randint(-2, 10)
        draw.text([i * width / char_length, h], char, font=font, fill=rndColor())

    # 写干扰点
    for i in range(100):
        draw.point([random.randint(0, width), random.randint(0, height)], fill=rndColor())

    # 写干扰圆圈
    for i in range(40):
        draw.point([random.randint(0, width), random.randint(0, height)], fill=rndColor())
        x = random.randint(0, width)
        y = random.randint(0, height)
        draw.arc((x, y, x +  random.randint(0, 10), y +  random.randint(0, 10)), 0, 90, fill=rndColor())

    # 画干扰线
    for i in range(6):
        x1 = random.randint(0, width)
        y1 = random.randint(0, height)
        x2 = random.randint(0, width)
        y2 = random.randint(0, height)

        draw.line((x1, y1, x2, y2), fill=rndColor())

    img = img.filter(ImageFilter.EDGE_ENHANCE_MORE)
    return img, ''.join(code)