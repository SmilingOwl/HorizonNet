import json
import open3d
import numpy as np
from numpy import ndarray
from PIL import Image
from tqdm import tqdm, trange
from scipy.ndimage import map_coordinates
import json

from misc.post_proc import np_coor2xy, np_coorx2u, np_coory2v
from misc.panostretch import pano_connect_points
from eval_general import layout_2_depth


if __name__ == '__main__':

    import argparse
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('--img', required=True,
                        help='Image texture in equirectangular format')
    parser.add_argument('--layout', required=True,
                        help='Txt file containing layout corners (cor_id)')
    parser.add_argument('--scale', default=1, type=float,
                        help='Scale texture for visualization')
    parser.add_argument('--ignore_floor', action='store_true',
                        help='Skip rendering floor')
    parser.add_argument('--ignore_ceiling', action='store_true',
                        help='Skip rendering ceiling')
    parser.add_argument('--ignore_wall', action='store_true',
                        help='Skip rendering wall')
    parser.add_argument('--ignore_wireframe', action='store_true',
                        help='Skip rendering wireframe')
    args = parser.parse_args()

    # Reading source (texture img, cor_id txt)
    equirect_texture = Image.open(args.img)
    if args.scale != 1:
        W, H = equirect_texture.size
        W = int(W * args.scale)
        H = int(H * args.scale)
        equirect_texture = equirect_texture.resize((W, H))
    equirect_texture = np.array(equirect_texture) / 255.0
    H, W = equirect_texture.shape[:2]
    with open(args.layout) as f:
        inferenced_result = json.load(f)
    cor_id = np.array(inferenced_result['uv'], np.float32)
    cor_id[:, 0] *= W
    cor_id[:, 1] *= H

    # Show wireframe
    if not args.ignore_wireframe:
        # Convert cor_id to 3d xyz
        N = len(cor_id) // 2
        floor_z = -1.6 # floor Z coord
        
        # floor xy coord
        floor_xy = np_coor2xy(cor_id[1::2], floor_z, W, H, floorW=1, floorH=1)
        c = np.sqrt((floor_xy**2).sum(1))
        v = np_coory2v(cor_id[0::2, 1], H)
        print(floor_xy)
        ceil_z = (c * np.tan(v)).mean() # ceil Z coord
        
        floor_values= []
        for i in range(2):
            floor_values.append([row[i] for row in floor_xy])
        
        floor_x = floor_values[0]
        floor_y = floor_values[1]

        dimension_x = max(floor_x, key=abs)
        dimension_y = max([ceil_z,floor_z], key=abs)
        dimension_z = max(floor_y, key=abs)
        
        # Data to be written 
        # dimensions
        dictionary = { 
        "dimensions": {
                "x": str(dimension_x),
                "y": str(dimension_y),
                "z": str(dimension_z),
            }
        } 

        # walls
        assert N == len(floor_xy)
        wall = [dict() for x in range(N)]
        
        for i in range(N):
            if i == (N-1):
                wall[i]= { "from": {"x": str(floor_xy[i][0]), "z": str(floor_xy[i][1])},
                            "to": {"x": str(floor_xy[0][0]), "z": str(floor_xy[0][1])},
                            "height": str(ceil_z)}
            else:
                wall[i]= { "from": {"x": str(floor_xy[i][0]), "z": str(floor_xy[i][1])},
                            "to": {"x": str(floor_xy[i+1][0]), "z": str(floor_xy[i+1][1])},
                            "height": str(ceil_z)}
        
        # floor
        points = [dict() for x in range(N)]
        
        for j in range(N):
            points[j] =  [str(floor_xy[j][0]), str(floor_xy[j][1])]

        # Append all parts
        dictionary["walls"] = wall
        obj = []
        dictionary["floor"] = points
        dictionary["objects"] = obj
        
        # Serializing json  
        json_object = json.dumps(dictionary, indent = 4) 
  
        # Writing to layout.json 
        outFileName="C:/Users/jm-marques/Desktop/HorizonNet/visual-demo/data/layout.json"
        with open(outFileName, "w") as outfile: 
            outfile.write(json_object) 

        # Prepare wireframe in open3d
        assert N == len(floor_xy)
        wf_points = [[x, y, floor_z] for x, y in floor_xy] +\
                    [[x, y, ceil_z] for x, y in floor_xy]
        wf_lines = [[i, (i+1)%N] for i in range(N)] +\
                   [[i+N, (i+1)%N+N] for i in range(N)] +\
                   [[i, i+N] for i in range(N)]
        wf_colors = [[1, 0, 0] for i in range(len(wf_lines))]
        wf_line_set = open3d.geometry.LineSet()
        wf_line_set.points = open3d.utility.Vector3dVector(wf_points)
        wf_line_set.lines = open3d.utility.Vector2iVector(wf_lines)
        wf_line_set.colors = open3d.utility.Vector3dVector(wf_colors)

    # Convert corners to layout
    depth, floor_mask, ceil_mask, wall_mask = layout_2_depth(cor_id, H, W, return_mask=True)
    coorx, coory = np.meshgrid(np.arange(W), np.arange(H))
    us = np_coorx2u(coorx, W)
    vs = np_coory2v(coory, H)
    zs = depth * np.sin(vs)
    cs = depth * np.cos(vs)
    xs = cs * np.sin(us)
    ys = -cs * np.cos(us)

    # Prepare points cloud
    all_xyz = np.stack([xs, ys, zs], -1).reshape(-1, 3)
    all_rgb = equirect_texture.reshape(-1, 3)
    if args.ignore_ceiling:
        mask = (~ceil_mask).reshape(-1)
        all_xyz = all_xyz[mask]
        all_rgb = all_rgb[mask]
    if args.ignore_floor:
        mask = (~floor_mask).reshape(-1)
        all_xyz = all_xyz[mask]
        all_rgb = all_rgb[mask]
    if args.ignore_wall:
        mask = (~wall_mask).reshape(-1)
        all_xyz = all_xyz[mask]
        all_rgb = all_rgb[mask]

    # Launch point cloud viewer
    pcd = open3d.geometry.PointCloud()
    pcd.points = open3d.utility.Vector3dVector(all_xyz)
    pcd.colors = open3d.utility.Vector3dVector(all_rgb)

    # Visualize result
    tobe_visualize = [pcd]
    if not args.ignore_wireframe:
        tobe_visualize.append(wf_line_set)
    open3d.visualization.draw_geometries(tobe_visualize)
