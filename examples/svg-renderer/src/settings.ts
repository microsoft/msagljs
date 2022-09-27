export const SAMPLE_DOT =
  `abstract a alf arrows arrowsize AvantGarde awilliams b100 b102 b103 b104 b106 b117 b123 b124 b135 b143 b145 b146 b155 b15 b22 b29 b33 b34 b36 b3 b491 b51 b53 b545 b56 b57 b58 b60 b62 b68 b69 b71 b73a b73 b76 b77 b786 b79 b7 b80a b80 b81 b85 b94 b993 bad badvoro b big biglabel Bookman cairo center channel clover clust1 clust2 clust3 clust4 clust5 clusters clust clustlabel color colorscheme colors compound Courier crazy ctext dd decorate dfa d dir dpd edgeclip ER fdp fig6 flatedge fsm grammar grdangles grdcluster grdcolors grdfillcolor grdlinear_angle grdlinear grdlinear_node grdradial_angle grdradial grdradial_node grdshapes hashtable Heawood Helvetica honda-tokoro html2 html in inv_inv inv_nul inv_val japanese jcctree jsort KW91 labelclust-fbc labelclust-fbd labelclust-fbl labelclust-fbr labelclust-fdc labelclust-fdd labelclust-fdl labelclust-fdr labelclust-ftc labelclust-ftd labelclust-ftl labelclust-ftr labelclust-nbc labelclust-nbd labelclust-nbl labelclust-nbr labelclust-ndc labelclust-ndd labelclust-ndl labelclust-ndr labelclust-ntc labelclust-ntd labelclust-ntl labelclust-ntr labelroot-fbc labelroot-fbd labelroot-fbl labelroot-fbr labelroot-fdc labelroot-fdd labelroot-fdl labelroot-fdr labelroot-ftc labelroot-ftd labelroot-ftl labelroot-ftr labelroot-nbc labelroot-nbd labelroot-nbl labelroot-nbr labelroot-ndc labelroot-ndd labelroot-ndl labelroot-ndr labelroot-ntc labelroot-ntd labelroot-ntl labelroot-ntr Latin1 layer2 layer layers ldbxtried longflat lsunix1 lsunix2 lsunix3 mike mode multi NaN nestedclust newarrows NewCenturySchlbk ngk10_4 nhg nojustify nul_inv nul_nul nul_val ordering overlap p2 p3 p4 pack Palatino Petersen pgram p pm2way pmpipe polypoly ports proc3d process ps pslib ps_user_shapes rd_rules record2 record records root rootlabel rowcolsep rowe russian sb_box_dbl sb_box sb_circle_dbl sb_circle shapes shells sides size sl_box_dbl sl_box sl_circle_dbl sl_circle smlred sq_rules sr_box_dbl sr_box sr_circle_dbl sr_circle states st_box_dbl st_box st_circle_dbl st_circle structs style Symbol Times train11 trapeziumlr tree triedds try unix2 unix2k unix url user_shapes val_inv val_nul val_val viewfile viewport weight world xlabels xx ZapfChancery ZapfDingbats`.split(
    ' ',
  )

export const ROUTING: {[value: string]: string} = {
  default: 'Default',
  splines: 'Splines',
  rectilinear: 'Rectilinear',
  bundles: 'Bundles',
  straight: 'Straight',
} as const

export const LAYOUT: {[value: string]: string} = {
  default: 'Default',
  tb: 'Layered Top-Bottom',
  lr: 'Layered Left-Right',
  bt: 'Layered Bottom-Top',
  rl: 'Layered Right-Left',
  ipsepCola: 'IPSepCola',
  mds: 'Pivot MDS',
} as const

export const FONT = ['Times New Roman', 'Arial', 'Georgia', 'Courier New', 'Verdana']
