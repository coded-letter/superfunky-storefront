export function hasOnlyMissingRootField(errors, fieldName) {
  if (!errors?.length) return false;
  const normalizedField = fieldName.toLowerCase();
  return errors.every(({ message }) => {
    const normalizedMessage = message.toLowerCase();
    return (
      normalizedMessage.includes(`cannot query field "${normalizedField}" on type "rootquery"`)
      || normalizedMessage.includes(`field "${normalizedField}" is not defined by type "rootquery"`)
    );
  });
}

export function hasOnlyMissingField(errors, fieldName, typeName) {
  if (!errors?.length) return false;
  const normalizedField = fieldName.toLowerCase();
  const normalizedType = typeName.toLowerCase();
  return errors.every(({ message }) => {
    const normalizedMessage = message.toLowerCase();
    return (
      normalizedMessage.includes(`cannot query field "${normalizedField}" on type "${normalizedType}"`)
      || normalizedMessage.includes(`field "${normalizedField}" is not defined by type "${normalizedType}"`)
    );
  });
}
