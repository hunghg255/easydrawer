/**
 * Returns true iff all elements in the shorter list equal (===) the elements
 * in the longer list.
 */
function listPrefixMatch <T>(a: T[], b: T[]) {
  const shorter = a.length < b.length ? a : b;
  const longer = shorter === a ? b : a;

  for (const [i, element] of shorter.entries()) {
    if (element !== longer[i]) {
      return false;
    }
  }

  return true;
}

export default listPrefixMatch;
