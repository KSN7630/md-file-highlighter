# Data Structures & Algorithms — Study Notes

These notes cover the core topics that come up in coding interviews. Each
section lists the key idea, the time/space complexity, and a small reference
implementation. Highlight the lines you want to revise before an interview.

> **How to use these notes:** skim the headings first, then highlight the
> facts you keep forgetting. The hivel with the file, so they show
> up on GitHub and in any Markdown preview.ghlights tra

---

## 1. Big-O Notation

Big-O describes how an algorithm's running time grows as the input size `n`
grows. We care about the **worst case** unless stated otherwise.

| Notation | Name | Example |
| --- | --- | --- |
| `O(1)` | Constant | Array index access |
| `O(log n)` | Logarithmic | Binary search |
| `O(n)` | Linear | Single loop over `n` items |
| `O(n log n)` | Linearithmic | Merge sort, heap sort |
| `O(n^2)` | Quadratic | Nested loops, bubble sort |
| `O(2^n)` | Exponential | Naive recursive Fibonacci |

Key rules:

1. Drop constants: `O(2n)` becomes `O(n)`.
2. Drop lower-order terms: `O(n^2 + n)` becomes `O(n^2)`.
3. Different inputs get different variables: `O(a + b)`, not `O(n)`.

---

## 2. Arrays vs Linked Lists

- **Array** — contiguous memory, `O(1)` random access, but `O(n)` insert/delete
  in the middle because elements must shift.
- **Linked list** — nodes scattered in memory, `O(1)` insert/delete given the
  node, but `O(n)` access because you must walk from the head.

A singly linked list node in Python:

```python
class Node:
    def __init__(self, value, nxt=None):
        self.value = value
        self.next = nxt

def reverse(head):
    prev = None
    while head:
        head.next, prev, head = prev, head, head.next
    return prev
```

> Remember: reversing a linked list is `O(n)` time and `O(1)` space — the
> classic three-pointer swap.

---

## 3. Binary Search

Binary search works only on a **sorted** array. Each step halves the search
space, giving `O(log n)` time.

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

Common pitfalls:

1. Off-by-one in `hi = len(arr) - 1` vs `hi = len(arr)`.
2. Integer overflow in `(lo + hi) // 2` (not an issue in Python, but is in C++).
3. Forgetting the array must be sorted first — sorting is `O(n log n)`.

---

## 4. Sorting Algorithms

| Algorithm | Best | Average | Worst | Space | Stable |
| --- | --- | --- | --- | --- | --- |
| Bubble sort | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | Yes |
| Insertion sort | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | Yes |
| Merge sort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` | Yes |
| Quick sort | `O(n log n)` | `O(n log n)` | `O(n^2)` | `O(log n)` | No |
| Heap sort | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(1)` | No |

Merge sort is the safe default when you need guaranteed `O(n log n)` and
stability. Quick sort is usually faster in practice but degrades to `O(n^2)`
on already-sorted input with a bad pivot.

---

## 5. Trees and Graphs

A **binary search tree** keeps `left < node < right`, giving `O(log n)`
search on a balanced tree — but `O(n)` if it degenerates into a linked list.

Graph traversal comes in two flavours:

- **BFS** (breadth-first) uses a queue and finds the shortest path in an
  unweighted graph.
- **DFS** (depth-first) uses a stack (or recursion) and is the basis for
  cycle detection and topological sort.

```python
from collections import deque

def bfs(graph, start):
    seen = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbour in graph[node]:
            if neighbour not in seen:
                seen.add(neighbour)
                queue.append(neighbour)
    return order
```

---

## 6. Dynamic Programming

Dynamic programming applies when a problem has **overlapping subproblems** and
**optimal substructure**. Two styles:

1. **Top-down (memoization)** — recurse, but cache results.
2. **Bottom-up (tabulation)** — fill a table from the base cases upward.

The classic example is Fibonacci, which goes from `O(2^n)` naive recursion to
`O(n)` with memoization:

```python
def fib(n, memo=None):
    memo = memo or {}
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib(n - 1, memo) + fib(n - 2, memo)
    return memo[n]
```

> Interview tip: always state the recurrence relation before you code. For the
> 0/1 knapsack it is `dp[i][w] = max(dp[i-1][w], value[i] + dp[i-1][w-weight[i]])`.

---

## Final Checklist

- Know the complexity table for every structure cold.
- Be able to code binary search and BFS/DFS without bugs.
- Always confirm input constraints before choosing an approach.
