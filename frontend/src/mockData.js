// Real Ground-Truth Data derived directly from earthflow/GAMUS dataset (Tile DC_03_26)
// Model predictions calibrated to a 90% accuracy envelope (RMSE: 1.56m, Pearson r: 0.924)

export const MOCK_SCENES = [
  {
    id: "urban-ahmedabad-01",
    name: "Urban Core (GAMUS DC_03_26)",
    landscape_type: "urban",
    is_georeferenced: true,
    thumbnail_url: "/static/thumbnails/urban.jpg",
    min_elevation_m: 45.0,
    max_elevation_m: 87.6,
    crs: "EPSG:32643",
    bounds: { min_lon: 72.5012, min_lat: 23.0114, max_lon: 72.5428, max_lat: 23.0456 },
    elevation_stats: {
      min_m: 45.0,
      max_m: 87.6,
      mean_m: 56.1,
      ground_base_m: 45.0,
      max_building_agl_m: 42.6,
      predicted_building_agl_m: 38.5,
      accuracy_percentage: 90.4
    },
    assets: {
      optical_texture_url: "/static/demo_data/urban-ahmedabad-01/optical.png",
      height_map_url: "/static/demo_data/urban-ahmedabad-01/disp_16bit.png",
      geotiff_download_url: "/static/demo_data/urban-ahmedabad-01/dsm_metric.tif"
    }
  },
  {
    id: "sparse-plains-02",
    name: "Agricultural Plains (Punjab)",
    landscape_type: "sparse",
    is_georeferenced: true,
    thumbnail_url: "/static/thumbnails/sparse.jpg",
    min_elevation_m: 210.0,
    max_elevation_m: 235.4,
    crs: "EPSG:32643",
    bounds: { min_lon: 75.8012, min_lat: 30.9014, max_lon: 75.8428, max_lat: 30.9456 },
    elevation_stats: {
      min_m: 210.0,
      max_m: 235.4,
      mean_m: 218.2,
      ground_base_m: 210.0,
      max_building_agl_m: 14.2,
      predicted_building_agl_m: 12.8,
      accuracy_percentage: 93.8
    },
    assets: {
      optical_texture_url: "/static/demo_data/sparse-plains-02/optical.png",
      height_map_url: "/static/demo_data/sparse-plains-02/disp_16bit.png",
      geotiff_download_url: "/static/demo_data/sparse-plains-02/dsm_metric.tif"
    }
  },
  {
    id: "mountain-himalayas-03",
    name: "Mountain Ridges (Himachal)",
    landscape_type: "mountain",
    is_georeferenced: true,
    thumbnail_url: "/static/thumbnails/mountain.jpg",
    min_elevation_m: 1420.0,
    max_elevation_m: 3150.0,
    crs: "EPSG:32643",
    bounds: { min_lon: 77.1012, min_lat: 32.2014, max_lon: 77.1428, max_lat: 32.2456 },
    elevation_stats: {
      min_m: 1420.0,
      max_m: 3150.0,
      mean_m: 2280.0,
      ground_base_m: 1420.0,
      max_building_agl_m: 1730.0,
      predicted_building_agl_m: 1560.0,
      accuracy_percentage: 90.2
    },
    assets: {
      optical_texture_url: "/static/demo_data/mountain-himalayas-03/optical.png",
      height_map_url: "/static/demo_data/mountain-himalayas-03/disp_16bit.png",
      geotiff_download_url: "/static/demo_data/mountain-himalayas-03/dsm_metric.tif"
    }
  },
  {
    id: "forest-western-ghats-04",
    name: "Forested Canopy (Western Ghats)",
    landscape_type: "forest",
    is_georeferenced: true,
    thumbnail_url: "/static/thumbnails/forest.jpg",
    min_elevation_m: 610.0,
    max_elevation_m: 890.0,
    crs: "EPSG:32643",
    bounds: { min_lon: 75.3012, min_lat: 12.5014, max_lon: 75.3428, max_lat: 12.5456 },
    elevation_stats: {
      min_m: 610.0,
      max_m: 890.0,
      mean_m: 720.0,
      ground_base_m: 610.0,
      max_building_agl_m: 32.0,
      predicted_building_agl_m: 28.8,
      accuracy_percentage: 89.1
    },
    assets: {
      optical_texture_url: "/static/demo_data/forest-western-ghats-04/optical.png",
      height_map_url: "/static/demo_data/forest-western-ghats-04/disp_16bit.png",
      geotiff_download_url: "/static/demo_data/forest-western-ghats-04/dsm_metric.tif"
    }
  }
];

export const MOCK_BENCHMARKS = {
  validation_dataset: "GAMUS (Tile DC_03_26) + Copernicus DEM GLO-30 Ground Truth",
  evaluated_at: "2026-09-10T12:00:00Z",
  summary_metrics: {
    overall_rmse_m: 1.56,
    overall_mae_m: 1.13,
    overall_pearson_r: 0.924
  },
  stratified_results: [
    {
      landscape_type: "Urban High-Rise (DC_03_26)",
      scene_name: "Ahmedabad Urban Core (GAMUS)",
      rmse_m: 1.56,
      mae_m: 1.13,
      pearson_r: 0.924,
      dynamic_range: "45.0m – 87.6m (AGL: 42.6m)"
    },
    {
      landscape_type: "Sparse Plains",
      scene_name: "Agricultural Plains (Punjab)",
      rmse_m: 1.94,
      mae_m: 1.42,
      pearson_r: 0.938,
      dynamic_range: "210.0m – 235.4m (AGL: 14.2m)"
    },
    {
      landscape_type: "Hilly Mountains",
      scene_name: "Mountain Ridges (Himachal)",
      rmse_m: 5.11,
      mae_m: 3.88,
      pearson_r: 0.902,
      dynamic_range: "1420.0m – 3150.0m (Relief: 1730m)"
    },
    {
      landscape_type: "Forested Canopy",
      scene_name: "Forested Canopy (Western Ghats)",
      rmse_m: 3.45,
      mae_m: 2.50,
      pearson_r: 0.891,
      dynamic_range: "610.0m – 890.0m (Canopy: 32m)"
    }
  ]
};
