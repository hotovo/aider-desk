({ agentProfile, data }) => {
  return agentProfile?.provider === 'synthetic' && data?.synthetic ? (
    data.synthetic.error ? (
      <span className="pt-1">Quota unavailable</span>
    ) : (
      <div className="flex items-center gap-2 pt-1 justify-between w-full">
        <span>Synthetic:</span>
        <div className="flex items-center gap-2">
          <span>{data.synthetic.used}/{data.synthetic.limit}</span>
          <span>({data.synthetic.percentage}%)</span>
        </div>
      </div>
    )
  ) : agentProfile?.provider === 'zai-plan' && data?.zai ? (
    <div className="flex items-center gap-2 pt-1 justify-between w-full">
      <span>Z.ai:</span>
      <div className="flex items-center gap-2">
        <span>5 Hours: {data.zai.hourlyPercentage}%</span>
        <span>|</span>
        <span>Weekly: {data.zai.weeklyPercentage}%</span>
      </div>
    </div>
  ) : null;
}
