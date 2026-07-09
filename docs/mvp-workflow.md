# MVP Workflow

1. User opens SiteForge and sees the Norway-focused map.
2. User draws a bounding box or polygon.
3. The frontend submits GeoJSON geometry to the API.
4. The API resolves intersecting Hoydedata DTM1 tiles.
5. The API downloads missing source GeoTIFFs into `data/cache`.
6. The API clips and decimates elevation data.
7. The API exports a terrain GLB and metadata sidecar.
8. The frontend displays the terrain GLB in a 3D scene.
9. User places a rough building volume.
10. User saves project JSON and exports GLB.

