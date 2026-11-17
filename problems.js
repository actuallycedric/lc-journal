// NeetCode 150, transcribed from the spec (Appendix A). Order matters:
// categories and problems appear exactly as listed there.
// Line format: `difficulty | title | leetcode-slug`, trailing `*` = premium.

const SOURCE = `
### Arrays & Hashing
E | Contains Duplicate | contains-duplicate
E | Valid Anagram | valid-anagram
E | Two Sum | two-sum
M | Group Anagrams | group-anagrams
M | Top K Frequent Elements | top-k-frequent-elements
M | Encode and Decode Strings | encode-and-decode-strings*
M | Product of Array Except Self | product-of-array-except-self
M | Valid Sudoku | valid-sudoku
M | Longest Consecutive Sequence | longest-consecutive-sequence

### Two Pointers
E | Valid Palindrome | valid-palindrome
M | Two Sum II - Input Array Is Sorted | two-sum-ii-input-array-is-sorted
M | 3Sum | 3sum
M | Container With Most Water | container-with-most-water
H | Trapping Rain Water | trapping-rain-water

### Sliding Window
E | Best Time to Buy and Sell Stock | best-time-to-buy-and-sell-stock
M | Longest Substring Without Repeating Characters | longest-substring-without-repeating-characters
M | Longest Repeating Character Replacement | longest-repeating-character-replacement
M | Permutation in String | permutation-in-string
H | Minimum Window Substring | minimum-window-substring
H | Sliding Window Maximum | sliding-window-maximum

### Stack
E | Valid Parentheses | valid-parentheses
M | Min Stack | min-stack
M | Evaluate Reverse Polish Notation | evaluate-reverse-polish-notation
M | Generate Parentheses | generate-parentheses
M | Daily Temperatures | daily-temperatures
M | Car Fleet | car-fleet
H | Largest Rectangle in Histogram | largest-rectangle-in-histogram

### Binary Search
E | Binary Search | binary-search
M | Search a 2D Matrix | search-a-2d-matrix
M | Koko Eating Bananas | koko-eating-bananas
M | Find Minimum in Rotated Sorted Array | find-minimum-in-rotated-sorted-array
M | Search in Rotated Sorted Array | search-in-rotated-sorted-array
M | Time Based Key-Value Store | time-based-key-value-store
H | Median of Two Sorted Arrays | median-of-two-sorted-arrays

### Linked List
E | Reverse Linked List | reverse-linked-list
E | Merge Two Sorted Lists | merge-two-sorted-lists
E | Linked List Cycle | linked-list-cycle
M | Reorder List | reorder-list
M | Remove Nth Node From End of List | remove-nth-node-from-end-of-list
M | Copy List with Random Pointer | copy-list-with-random-pointer
M | Add Two Numbers | add-two-numbers
M | Find the Duplicate Number | find-the-duplicate-number
M | LRU Cache | lru-cache
H | Merge k Sorted Lists | merge-k-sorted-lists
H | Reverse Nodes in k-Group | reverse-nodes-in-k-group

### Trees
E | Invert Binary Tree | invert-binary-tree
E | Maximum Depth of Binary Tree | maximum-depth-of-binary-tree
E | Diameter of Binary Tree | diameter-of-binary-tree
E | Balanced Binary Tree | balanced-binary-tree
E | Same Tree | same-tree
E | Subtree of Another Tree | subtree-of-another-tree
M | Lowest Common Ancestor of a Binary Search Tree | lowest-common-ancestor-of-a-binary-search-tree
M | Binary Tree Level Order Traversal | binary-tree-level-order-traversal
M | Binary Tree Right Side View | binary-tree-right-side-view
M | Count Good Nodes in Binary Tree | count-good-nodes-in-binary-tree
M | Validate Binary Search Tree | validate-binary-search-tree
M | Kth Smallest Element in a BST | kth-smallest-element-in-a-bst
M | Construct Binary Tree from Preorder and Inorder Traversal | construct-binary-tree-from-preorder-and-inorder-traversal
H | Binary Tree Maximum Path Sum | binary-tree-maximum-path-sum
H | Serialize and Deserialize Binary Tree | serialize-and-deserialize-binary-tree

### Heap / Priority Queue
E | Kth Largest Element in a Stream | kth-largest-element-in-a-stream
E | Last Stone Weight | last-stone-weight
M | K Closest Points to Origin | k-closest-points-to-origin
M | Kth Largest Element in an Array | kth-largest-element-in-an-array
M | Task Scheduler | task-scheduler
M | Design Twitter | design-twitter
H | Find Median from Data Stream | find-median-from-data-stream

### Backtracking
M | Subsets | subsets
M | Combination Sum | combination-sum
M | Combination Sum II | combination-sum-ii
M | Permutations | permutations
M | Subsets II | subsets-ii
M | Word Search | word-search
M | Palindrome Partitioning | palindrome-partitioning
M | Letter Combinations of a Phone Number | letter-combinations-of-a-phone-number
H | N-Queens | n-queens

### Tries
M | Implement Trie (Prefix Tree) | implement-trie-prefix-tree
M | Design Add and Search Words Data Structure | design-add-and-search-words-data-structure
H | Word Search II | word-search-ii

### Graphs
M | Number of Islands | number-of-islands
M | Max Area of Island | max-area-of-island
M | Clone Graph | clone-graph
M | Walls and Gates | walls-and-gates*
M | Rotting Oranges | rotting-oranges
M | Pacific Atlantic Water Flow | pacific-atlantic-water-flow
M | Surrounded Regions | surrounded-regions
M | Course Schedule | course-schedule
M | Course Schedule II | course-schedule-ii
M | Graph Valid Tree | graph-valid-tree*
M | Number of Connected Components in an Undirected Graph | number-of-connected-components-in-an-undirected-graph*
M | Redundant Connection | redundant-connection
H | Word Ladder | word-ladder

### Advanced Graphs
M | Network Delay Time | network-delay-time
H | Reconstruct Itinerary | reconstruct-itinerary
M | Min Cost to Connect All Points | min-cost-to-connect-all-points
H | Swim in Rising Water | swim-in-rising-water
H | Alien Dictionary | alien-dictionary*
M | Cheapest Flights Within K Stops | cheapest-flights-within-k-stops

### 1-D Dynamic Programming
E | Climbing Stairs | climbing-stairs
E | Min Cost Climbing Stairs | min-cost-climbing-stairs
M | House Robber | house-robber
M | House Robber II | house-robber-ii
M | Longest Palindromic Substring | longest-palindromic-substring
M | Palindromic Substrings | palindromic-substrings
M | Decode Ways | decode-ways
M | Coin Change | coin-change
M | Maximum Product Subarray | maximum-product-subarray
M | Word Break | word-break
M | Longest Increasing Subsequence | longest-increasing-subsequence
M | Partition Equal Subset Sum | partition-equal-subset-sum

### 2-D Dynamic Programming
M | Unique Paths | unique-paths
M | Longest Common Subsequence | longest-common-subsequence
M | Best Time to Buy and Sell Stock with Cooldown | best-time-to-buy-and-sell-stock-with-cooldown
M | Coin Change II | coin-change-ii
M | Target Sum | target-sum
M | Interleaving String | interleaving-string
H | Longest Increasing Path in a Matrix | longest-increasing-path-in-a-matrix
H | Distinct Subsequences | distinct-subsequences
M | Edit Distance | edit-distance
H | Burst Balloons | burst-balloons
H | Regular Expression Matching | regular-expression-matching

### Greedy
M | Maximum Subarray | maximum-subarray
M | Jump Game | jump-game
M | Jump Game II | jump-game-ii
M | Gas Station | gas-station
M | Hand of Straights | hand-of-straights
M | Merge Triplets to Form Target Triplet | merge-triplets-to-form-target-triplet
M | Partition Labels | partition-labels
M | Valid Parenthesis String | valid-parenthesis-string

### Intervals
M | Insert Interval | insert-interval
M | Merge Intervals | merge-intervals
M | Non-overlapping Intervals | non-overlapping-intervals
E | Meeting Rooms | meeting-rooms*
M | Meeting Rooms II | meeting-rooms-ii*
H | Minimum Interval to Include Each Query | minimum-interval-to-include-each-query

### Math & Geometry
M | Rotate Image | rotate-image
M | Spiral Matrix | spiral-matrix
M | Set Matrix Zeroes | set-matrix-zeroes
E | Happy Number | happy-number
E | Plus One | plus-one
M | Pow(x, n) | powx-n
M | Multiply Strings | multiply-strings
M | Detect Squares | detect-squares

### Bit Manipulation
E | Single Number | single-number
E | Number of 1 Bits | number-of-1-bits
E | Counting Bits | counting-bits
E | Reverse Bits | reverse-bits
E | Missing Number | missing-number
M | Sum of Two Integers | sum-of-two-integers
M | Reverse Integer | reverse-integer
`

function parse(text) {
  const out = []
  let category = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('### ')) {
      category = line.slice(4)
      continue
    }
    const [difficulty, title, slug] = line.split(' | ')
    const premium = slug.endsWith('*')
    out.push({ id: premium ? slug.slice(0, -1) : slug, title, category, difficulty, premium })
  }
  return out
}

export const PROBLEMS = parse(SOURCE)

export const CATEGORIES = [...new Set(PROBLEMS.map((p) => p.category))]

// dev-time sanity checks
if (PROBLEMS.length !== 150) console.error(`problems.js: expected 150 problems, got ${PROBLEMS.length}`)
if (new Set(PROBLEMS.map((p) => p.id)).size !== PROBLEMS.length) console.error('problems.js: duplicate ids')
if (CATEGORIES.length !== 18) console.error(`problems.js: expected 18 categories, got ${CATEGORIES.length}`)
