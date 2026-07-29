import os
from django.utils import timezone  # 使用Django的时区工具

# =======================
# 1. 缩略图生成器 (保持之前的 Pillow 版本不变)
# =======================
def generate_track_thumbnail(points):
    """
    使用 Pillow 绘制平滑的轨迹缩略图 (透明背景)
    """
    from io import BytesIO

    from django.core.files.base import ContentFile
    from PIL import Image, ImageDraw

    # 1. 过滤有效点
    track_points = [(p['lon'], p['lat']) for p in points if p.get('lat') and p.get('lon')]

    # 点太少无法画线
    if not track_points or len(track_points) < 2:
        return None

    # 2. 配置参数
    TARGET_SIZE = (400, 400)  # 最终输出尺寸
    SCALE_FACTOR = 4  # Preserve the original high-quality supersampling.
    W, H = TARGET_SIZE[0] * SCALE_FACTOR, TARGET_SIZE[1] * SCALE_FACTOR
    PADDING = 40 * SCALE_FACTOR

    # 3. 计算边界
    lons = [p[0] for p in track_points]
    lats = [p[1] for p in track_points]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    diff_lon = max_lon - min_lon
    diff_lat = max_lat - min_lat

    # 防止除以零
    if diff_lon == 0: diff_lon = 0.0001
    if diff_lat == 0: diff_lat = 0.0001

    # 4. 计算比例
    # 我们希望留出 Padding，所以用 (W - PADDING*2)
    ratio_x = (W - PADDING * 2) / diff_lon
    ratio_y = (H - PADDING * 2) / diff_lat
    ratio = min(ratio_x, ratio_y)

    # 5. 坐标转换
    def to_px(lon, lat):
        x = (lon - min_lon) * ratio + (W - diff_lon * ratio) / 2
        # Y轴翻转：纬度越大约靠上，屏幕Y越小
        y = (max_lat - lat) * ratio + (H - diff_lat * ratio) / 2
        return x, y

    px_points = [to_px(lo, la) for lo, la in track_points]

    # 6. 绘图
    # RGBA 模式，(255, 255, 255, 0) 表示完全透明背景
    image = resized_image = buffer = None
    try:
        image = Image.new("RGBA", (W, H), (255, 255, 255, 0))
        draw = ImageDraw.Draw(image)

        # 绘制线条：橙色 (252, 76, 2)
        draw.line(px_points, fill=(252, 76, 2), width=20, joint='curve')

        # 7. 缩放 (抗锯齿)
        resized_image = image.resize(TARGET_SIZE, resample=Image.Resampling.LANCZOS)
        buffer = BytesIO()
        resized_image.save(buffer, format='PNG')
        return ContentFile(buffer.getvalue())
    finally:
        if buffer is not None:
            buffer.close()
        if resized_image is not None:
            resized_image.close()
        if image is not None:
            image.close()
# =======================
# 2. FIT 解析 (基于你提供的 session 提取逻辑改造)
# =======================
def parse_fit_file(file_path):
    """
    解析 FIT 文件：
    1. 使用 StandardUnitsDataProcessor 自动转换单位 (半圆->度, m/s等)
    2. 优先从 session 消息读取精准统计数据
    3. 遍历 record 消息获取轨迹点
    """
    import fitparse
    from fitparse import FitFile

    data = {
        'points': [],
        'start_time': timezone.now(),
        # 统一输出字段名以匹配 Model
        'total_distance': 0.0,  # km
        'total_duration': 0,  # seconds
        'total_ascent': 0.0,  # meters
        'avg_speed': 0.0,  # km/h
        'max_speed': 0.0,  # km/h
        'avg_heart_rate': None,
        'avg_power': None,
        'total_calories': None
    }

    try:
        # 使用 StandardUnitsDataProcessor，这样 position_lat 就是度数，不需要 * (180/2^31)
        fitfile = FitFile(file_path, data_processor=fitparse.StandardUnitsDataProcessor())

        # --- A. 提取元数据 (你的核心要求) ---
        # 只需要找 session 消息，不需要自己算
        for msg in fitfile.get_messages('session'):
            vals = msg.get_values()

            if 'start_time' in vals:
                data['start_time'] = vals['start_time']

            # FIT 标准单位是 meter，除以 1000 转 km
            if 'total_distance' in vals:
                data['total_distance'] = round(vals['total_distance'] / 1000.0, 2)
            if 'total_timer_time' in vals:
                data['total_timer_time'] = int(vals['total_timer_time'])
            if 'total_elapsed_time' in vals:
                data['total_duration'] = int(vals['total_elapsed_time'])

            if 'total_ascent' in vals:
                data['total_ascent'] = int(vals['total_ascent'])


            if 'avg_speed' in vals:
                data['avg_speed'] = round(vals['avg_speed'] , 1)
            if 'max_speed' in vals:
                data['max_speed'] = round(vals['max_speed'] , 1)

            data['avg_heart_rate'] = vals.get('avg_heart_rate')
            data['avg_power'] = vals.get('avg_power')
            data['total_calories'] = vals.get('total_calories')

            # 找到 session 就跳出，避免多条 session (通常骑行只有一个 session)
            break

            # --- B. 提取轨迹点 (用于画图和详情页图表) ---
        points = []
        for record in fitfile.get_messages('record'):
            vals = record.get_values()

            # 只有含坐标的点才是有意义的轨迹点
            if 'position_lat' in vals and 'position_long' in vals:
                points.append({
                    # 因为用了 StandardUnitsDataProcessor，这里直接就是度数
                    'lat': vals['position_lat'],
                    'lon': vals['position_long'],
                    'ele': vals.get('altitude'),
                    'time': vals.get('timestamp').isoformat() if vals.get('timestamp') else None,
                    'speed': (vals.get('speed', 0) or 0) * 3.6,  # m/s -> km/h
                    'heart_rate': vals.get('heart_rate'),
                    'power': vals.get('power'),
                    'cadence': vals.get('cadence')
                })

        data['points'] = points

    except Exception as e:
        print(f"FIT Parse Error {file_path}: {e}")
        return {}

    return data


# =======================
# 3. GPX 解析 (基于你的 gpxpy 优化逻辑)
# =======================
def parse_gpx_file(file_path):
    """
    解析 GPX 文件：
    使用 gpxpy 内置方法快速获取 length_2d, duration 等
    """
    import gpxpy

    data = {
        'points': [],
        'start_time': timezone.now(),
        'total_distance': 0.0,
        'total_duration': 0,
        'total_ascent': 0.0,
        'avg_speed': 0.0,
        'max_speed': 0.0,
        'avg_heart_rate': None,
        'avg_power': None,
        'total_calories': None
    }

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            gpx = gpxpy.parse(f)

        # --- A. 提取元数据 (你的核心要求) ---
        # 1. 时间
        time_bounds = gpx.get_time_bounds()
        if time_bounds.start_time:
            data['start_time'] = time_bounds.start_time

        # 2. 距离 (GPXpy 计算比较准)
        data['total_distance'] = round(gpx.length_2d() / 1000.0, 2)  # m -> km

        # 3. 时间 (Duration)
        # get_duration() 返回 float，包含暂停时间与否取决于 gpxpy 版本，通常是 elapsed
        data['total_duration'] = int(gpx.get_duration() or 0)

        # 4. 爬升
        uphill_downhill = gpx.get_uphill_downhill()
        data['total_ascent'] = int(uphill_downhill.uphill or 0)

        # 5. 速度 (Moving Data)
        moving_data = gpx.get_moving_data()
        if moving_data:
            # max_speed m/s -> km/h
            data['max_speed'] = round(moving_data.max_speed * 3.6, 1) if moving_data.max_speed else 0
            # 计算均速 (总距离km / 总小时h)
            hours = moving_data.moving_time / 3600.0
            if hours > 0:
                data['avg_speed'] = round(data['total_distance'] / hours, 1)

        # --- B. 提取轨迹点 ---
        points = []
        for track in gpx.tracks:
            for segment in track.segments:
                for pt in segment.points:
                    points.append({
                        'lat': pt.latitude,
                        'lon': pt.longitude,
                        'ele': pt.elevation,
                        'time': pt.time.isoformat() if pt.time else None,
                        # GPX 标准通常不含 HR/Power，除非是扩展格式，这里给 None 保证前端兼容
                        'heart_rate': None,
                        'power': None,
                        'cadence': None,
                        'speed': 0
                    })

        data['points'] = points

    except Exception as e:
        print(f"GPX Parse Error {file_path}: {e}")
        return {}

    return data


# =======================
# 4. 通用入口 (保持不变)
# =======================
def parse_ride_file(file_path):
    if not os.path.exists(file_path):
        return {}

    ext = file_path.lower().split('.')[-1]

    if ext == 'fit':
        return parse_fit_file(file_path)
    elif ext == 'gpx':
        return parse_gpx_file(file_path)

    return {}
