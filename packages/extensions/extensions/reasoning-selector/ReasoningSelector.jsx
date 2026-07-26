({ data, icons, executeExtensionAction }) => {
  const { useState, useCallback, useEffect, useRef } = React;
  const MdKeyboardArrowUp = icons.Md.MdKeyboardArrowUp;
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef(null);
  const currentValue = data?.reasoningEffort || "";
  const selectedOption = data?.options?.find((option) => option.value === currentValue);

  const handleChange = useCallback(
    async (value) => {
      setIsOpen(false);
      await executeExtensionAction("set-reasoning", value);
    },
    [executeExtensionAction]
  );

  const handleToggle = useCallback(() => {
    setIsOpen((previousIsOpen) => !previousIsOpen);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!data?.isAgentMode) {
    return null;
  }

  return (
    <div className="relative flex-shrink-0" ref={selectorRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex flex-col items-start gap-0.5 text-2xs focus:outline-none transition-colors duration-200 hover:text-text-tertiary"
      >
        <span className="text-text-muted leading-none">Reasoning</span>
        <span className="flex items-center gap-1 font-medium leading-tight">
          {selectedOption?.label || "Use default"}
          <MdKeyboardArrowUp className="w-3 h-3 flex-shrink-0 rotate-180" />
        </span>
      </button>
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 overflow-hidden rounded-md border border-border-default-dark bg-bg-primary-light shadow-lg z-50"
          style={{ minWidth: "8rem" }}
        >
          {data.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange(option.value)}
              className={`block w-full px-3 py-1 text-left text-xs transition-colors duration-200 hover:bg-bg-tertiary ${option.value === currentValue ? "text-text-primary" : "text-text-tertiary"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
