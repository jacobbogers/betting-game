export const bestBetPerUser = `
with highest_wins as (
    select * from bets a 
        where a.win=true and not exists (select 1 from bets b where a."UserId" = b."UserId" and a.payout < b.payout and a.win=b.win) 
  ),
  dedup_highest as (
      select * from highest_wins  a where not exists (select 1 from highest_wins b where a."UserId" = b."UserId" and a.id < b.id)
  )
  SELECT * from dedup_highest
`;