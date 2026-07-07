package com.wagerproof.core.design.pixeloffice

import kotlin.math.abs

/** One tile of the pathfinder grid. */
data class GridCoord(val col: Int, val row: Int)

/**
 * 8-directional A* over the office collision grid — port of
 * `PixelOfficePathfinding` in iOS `PixelOfficeAssets.swift` (itself from
 * PixelOffice.tsx). Orthogonal cost 1, diagonal 1.4; Manhattan heuristic; the
 * END tile is allowed even if blocked (interaction points sit on furniture);
 * diagonals may not cut corners; aborts after 2000 closed nodes; no-path
 * fallback = the destination tile directly.
 */
object PixelOfficePathfinding {
    const val gridCols = PixelOfficeCollision.GRID_COLS
    const val gridRows = PixelOfficeCollision.GRID_ROWS

    private val blocked get() = PixelOfficeCollision.blocked

    fun tileCenterX(col: Int): Float = PixelOfficeCollision.tileCenterX(col)
    fun tileCenterY(row: Int): Float = PixelOfficeCollision.tileCenterY(row)
    fun pixToCol(x: Float): Int = PixelOfficeCollision.pixToCol(x)
    fun pixToRow(y: Float): Int = PixelOfficeCollision.pixToRow(y)

    private fun key(c: Int, r: Int): Int = r * gridCols + c

    private class ANode(
        val col: Int,
        val row: Int,
        var g: Float,
        var f: Float,
        var parent: ANode?,
    )

    private class Dir(val dc: Int, val dr: Int, val cost: Float)

    private val dirs = listOf(
        Dir(0, -1, 1f), Dir(0, 1, 1f),
        Dir(-1, 0, 1f), Dir(1, 0, 1f),
        Dir(-1, -1, 1.4f), Dir(1, -1, 1.4f),
        Dir(-1, 1, 1.4f), Dir(1, 1, 1.4f),
    )

    /**
     * Returns tile centers to walk, EXCLUDING the start tile. Empty when
     * start == end; a single direct tile when no path is found (RN fallback).
     */
    fun aStar(startCol: Int, startRow: Int, endCol: Int, endRow: Int): List<GridCoord> {
        val sc = startCol.coerceIn(0, gridCols - 1)
        val sr = startRow.coerceIn(0, gridRows - 1)
        val ec = endCol.coerceIn(0, gridCols - 1)
        val er = endRow.coerceIn(0, gridRows - 1)
        if (sc == ec && sr == er) return emptyList()

        fun h(c: Int, r: Int): Float = (abs(c - ec) + abs(r - er)).toFloat()

        val closed = HashSet<Int>()
        val openMap = HashMap<Int, ANode>()
        val start = ANode(sc, sr, 0f, h(sc, sr), null)
        // Sorted-scan open list mirrors the RN/Swift implementation — the grid
        // is tiny (27×25), a binary heap would be over-engineering.
        val openList = ArrayList<ANode>()
        openList.add(start)
        openMap[key(sc, sr)] = start

        while (openList.isNotEmpty()) {
            openList.sortBy { it.f }
            val current = openList.removeAt(0)
            val ck = key(current.col, current.row)
            openMap.remove(ck)

            if (current.col == ec && current.row == er) {
                val path = ArrayList<GridCoord>()
                var node: ANode? = current
                while (node != null && !(node.col == sc && node.row == sr)) {
                    path.add(0, GridCoord(node.col, node.row))
                    node = node.parent
                }
                return path
            }

            closed.add(ck)

            for (d in dirs) {
                val nc = current.col + d.dc
                val nr = current.row + d.dr
                if (nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows) continue
                val nk = key(nc, nr)
                if (nk in closed) continue
                // Allow the end tile even if blocked (points sit near furniture).
                if (nk in blocked && !(nc == ec && nr == er)) continue
                // Diagonal: don't cut corners through walls.
                if (d.dc != 0 && d.dr != 0) {
                    if (key(current.col + d.dc, current.row) in blocked ||
                        key(current.col, current.row + d.dr) in blocked
                    ) {
                        continue
                    }
                }
                val g = current.g + d.cost
                val existing = openMap[nk]
                if (existing != null) {
                    if (g < existing.g) {
                        existing.g = g
                        existing.f = g + h(nc, nr)
                        existing.parent = current
                    }
                } else {
                    val node = ANode(nc, nr, g, g + h(nc, nr), current)
                    openList.add(node)
                    openMap[nk] = node
                }
            }

            if (closed.size > 2000) break
        }

        // No path found — direct fallback to the destination tile.
        return listOf(GridCoord(ec, er))
    }
}
