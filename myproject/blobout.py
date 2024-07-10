import os
import django
import pymysql
import uuid
from PIL import Image
from io import BytesIO


def convert_blob_to_file(blob_data, file_path):
    with open(file_path, 'wb') as file:
        file.write(blob_data)


def main():
    # 连接到旧的 MySQL 数据库
    connection = pymysql.connect(
        host='localhost',
        user='root',
        password='Alexmercer2000@',
        database='db'
    )
    cursor = connection.cursor()

    # 读取旧的 BLOB 数据
    cursor.execute("SELECT 动画名称,图片 FROM 追番记录")
    rows = cursor.fetchall()

    for row in rows:

        image_id, image_blob = row
        print(image_id)
        if image_blob is None or len(image_blob) == 0:
            print(f"Skipping image_id {image_id} due to empty or null BLOB data")
            continue
        random_name = f'{uuid.uuid4()}.'
        image = Image.open(BytesIO(image_blob))
        # 创建新的 ImageModel 实例
        format = image.format.lower()
        if format == 'webp':
            format = 'jpg'
        file_path = f'media/Base/episode/pic/%s' % (random_name + format)
        cursor.execute("UPDATE 追番记录 SET pic = '%s' WHERE 动画名称 ='%s'"%("Base/episode/pic/"+random_name + format,image_id))

        convert_blob_to_file(image_blob, file_path)
        with open(file_path, 'wb') as file:
            file.write(image_blob)
    connection.commit()
    connection.close()


if __name__ == "__main__":
    main()