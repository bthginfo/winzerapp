export const profileFields:Record<string,string[]>={
 opening:['lot_code','vessel_code','name','grape','vintage','quantity_l','capacity_l','cost_per_l'],
 analyses:['lot_code','sample_code','sampled_at','parameter','value','unit','method','measured_at','quality'],
 vessels:['code','name','kind','capacity_l'],
 vineyards:['code','name','grape','area_ha','planted_year'],
 materials:['code','name','kind','unit','cost_per_unit','reorder_at'],
 skus:['product_name','code','fill_l','erp_reference'],
 harvests:['vineyard_code','code','vintage','quantity_kg','received_at','quality'],
 field:['vineyard_code','season_id','kind','description','performed_at','hours','area_ha','product','product_batch','quantity','unit','operator','authorization','source'],
 weather:['vineyard_code','issued_at','latitude','longitude','temperature','precipitation','wind_speed','source']
};
