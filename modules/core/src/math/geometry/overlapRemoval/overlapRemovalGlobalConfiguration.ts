export class OverlapRemovalGlobalConfiguration {
  //  Default weight for a freely movable cluster border; overridable per BorderInfo instance.
  //  Should be very small compared to default node weight (1) so that it has no visible effect on layout.
  //  Too large and it will cause clusters to be squashed by their bounding variables (since OverlapRemovalCluster
  //  swaps the positions of Left/Right, Top/Bottom nodes to ensure that cluster bounds tightly fit their contents after a solve).
  //  Too small and you will see cluster boundaries "sticking" to nodes outside the cluster (because such constraints will not be
  //  split when they can be because the lagrangian multipliers will be so small as to be ignored before solver termination).

  public static /* const */ ClusterDefaultFreeWeight = 1e-6

  //  Default weight for an unfixed (freely movable) cluster border; overridable per BorderInfo instance.

  public static /* const */ ClusterDefaultFixedWeight = 100000000

  //  Default width of cluster borders; overridable per BorderInfo instance via BorderInfo.InnerMargin.

  public static /* const */ ClusterDefaultBorderWidth = 0.001

  static /* const */ EventComparisonEpsilon = 1e-6
}
